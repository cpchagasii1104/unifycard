/**
 * E2E F-ACTOR-CAPABILITY-GRANTS-SERVICES-EDIT-DISABLE — completa o conjunto básico de authority de serviço.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-actor-capability-grants-services-edit-disable-ephemeral.ps1.
 *
 * Replica o padrão selado em services:create, agora para EDIT e DISABLE em servicesService.updateService
 * (writer único; disable = transição status → 'paused'). Composição ADITIVA por capability REQUERIDA pela
 * OPERAÇÃO, fail-closed (service layer):
 *   • edit (campo ≠ status, ou status não-disable: reativar/draft↔active) → 'services:edit'
 *   • disable (status → 'paused')                                          → 'services:disable'
 *   • misto (edita campo E pausa no mesmo PUT)                             → EXIGE AS DUAS
 *   • owner/canRepresentActor faz tudo (preservado).
 * services:disable NUNCA edita; services:edit NUNCA pausa; reativar exige services:edit; sem wildcard/prefix;
 * referral fora; grant não troca dono/provider/tenant/concept (estrutural — UpdateServiceInput não os expõe).
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor, ensurePageActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
import { servicesService } from '../modules/services/services.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { actorCapabilityGrantService } from '../modules/authority/actor-capability-grant.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/capability|grant|slice|services|edit|disable|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: unknown): { code?: string; msg: string } => ({ code: (e as { code?: string })?.code, msg: e instanceof Error ? e.message : String(e) });
const isAuthDenial = (msg?: string): boolean => /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(msg || '');

let seq = 0;
async function seedCivilActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`,
    [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]
  );
  const actor = await ensureUserActor(tenantId, userId);
  return { userId, actorId: actor.actor_id, globalUserId: gu };
}

async function mkCanonical(tenantId: string, conceptId: string, label: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status)
       VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`,
    [id, tenantId, conceptId, `Canon ${label}`, `canon-${label}-${id.slice(0, 8)}`]
  );
  return id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Capability Grants Edit/Disable', slug: `cged-${Date.now()}` });

  const triple = (await pool.query<{ company_type_id: string; service_category_id: string; concept_id: string }>(
    `SELECT ctsc.company_type_id::text AS company_type_id, ctsc.service_category_id::text AS service_category_id, ctac.concept_id::text AS concept_id
       FROM company_type_service_categories ctsc
       JOIN company_type_allowed_concepts ctac ON ctac.company_type_id = ctsc.company_type_id
       JOIN categories cat ON cat.category_id = ctsc.service_category_id
      WHERE cat.metadata->>'domain' = 'servicos'
      ORDER BY ctsc.company_type_id, ctac.concept_id LIMIT 1`
  )).rows[0];
  if (!triple) throw new Error('catálogo FULL não forneceu triple.');
  const { company_type_id: companyTypeId, service_category_id: categoryId, concept_id: publishedConcept } = triple;
  // categoria de OUTRO domínio (não-servicos) p/ provar que o grant não bypassa o gate de categoria.
  const nonServicosCat = (await pool.query<{ c: string }>(
    `SELECT category_id::text AS c FROM categories WHERE metadata->>'domain' IS NOT NULL AND metadata->>'domain' <> 'servicos' LIMIT 1`
  )).rows[0]?.c || randomUUID();

  // empresa PJ publicada/operacional/KYB-approved (reuso da espinha selada).
  const owner = await seedCivilActor(TENANT_ID, 'OwnerHumano');
  const cnpj = String(Date.now() + (seq += 1)).padStart(14, '0').slice(-14);
  const fiscalId = (await pool.query<{ f: string }>(
    `INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,'approved',$2::uuid, now()) RETURNING fiscal_identity_id::text AS f`,
    [cnpj, owner.actorId]
  )).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1::uuid,$2,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, 'EditDisable Provider LTDA', fiscalId]
  )).rows[0].c;
  const pageActor = await ensurePageActor(TENANT_ID, companyId, owner.actorId);
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(TENANT_ID, pageActor.actor_id, 'company', 'companies', companyId);
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`,
    [TENANT_ID, companyId, owner.globalUserId]
  );
  await companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId, primaryCompanyTypeId: companyTypeId, primaryConceptId: publishedConcept });
  await companyPublicationsService.publishCompanyConcept({ tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId, globalUserId: owner.globalUserId, conceptId: publishedConcept });

  const scope = pageActor.actor_id; // escopo dos grants = page-actor da empresa

  // cria serviço (owner) e, opcional, leva a um status; cada serviço tem canonical próprio (sem colisão).
  async function mkService(label: string, status: ServiceStatus = ServiceStatus.ACTIVE): Promise<string> {
    const canon = await mkCanonical(TENANT_ID, publishedConcept, label);
    const svc = await servicesService.createService(TENANT_ID, owner.userId, {
      actorId: scope, name: `Svc ${label}`, categoryId, canonicalServiceId: canon, serviceType: ServiceType.SERVICE,
    });
    if (status !== ServiceStatus.DRAFT) {
      await servicesService.updateService(TENANT_ID, svc.serviceId, owner.userId, { status });
    }
    return svc.serviceId;
  }
  const grant = (granteeActorId: string, capabilityKey: string, scopeActorId: string = scope) =>
    actorCapabilityGrantService.grant(TENANT_ID, { granteeActorId, capabilityKey: capabilityKey as any, scopeActorId, grantedByUserId: owner.userId, grantedByActorId: owner.actorId, eventReason: 'e2e services-edit-disable' });
  async function upd(userId: string, serviceId: string, input: Record<string, unknown>): Promise<{ ok: boolean; err?: { code?: string; msg: string } }> {
    try { await servicesService.updateService(TENANT_ID, serviceId, userId, input as any); return { ok: true }; }
    catch (e) { return { ok: false, err: errOf(e) }; }
  }

  const emp = await seedCivilActor(TENANT_ID, 'OpEdit');      // receberá services:edit
  const empD = await seedCivilActor(TENANT_ID, 'OpDisable');  // receberá services:disable
  const empX = await seedCivilActor(TENANT_ID, 'OpWrong');    // escopo errado / capability errada
  const empB = await seedCivilActor(TENANT_ID, 'OpBoth');     // receberá ambas

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`);
  const availBefore = await count(`SELECT (SELECT count(*) FROM availability)::int AS n`);
  const schedBefore = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);

  // ── OWNER (preservado) ──
  record('T1 owner edita campo → OK', (await upd(owner.userId, await mkService('t1'), { name: 'Novo Nome' })).ok);
  record('T2 owner pausa (→paused) → OK', (await upd(owner.userId, await mkService('t2'), { status: 'paused' })).ok);

  // ── SEM GRANT ──
  { const r = await upd(emp.userId, await mkService('t3'), { name: 'x' }); record('T3 sem grant edita → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  { const r = await upd(emp.userId, await mkService('t4'), { status: 'paused' }); record('T4 sem grant pausa → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }

  // ── services:edit ──
  const gEdit = await grant(emp.actorId, 'services:edit');
  record('T5 services:edit edita campo → OK', (await upd(emp.userId, await mkService('t5'), { name: 'Editado' })).ok);
  { const r = await upd(emp.userId, await mkService('t6'), { status: 'paused' }); record('T6 services:edit tenta pausar → 403 (precisa services:disable)', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  record('T10 services:edit reativa paused→active → OK', (await upd(emp.userId, await mkService('t10', ServiceStatus.PAUSED), { status: 'active' })).ok);

  // ── services:disable ──
  await grant(empD.actorId, 'services:disable');
  record('T7 services:disable pausa sem mudar campos → OK', (await upd(empD.userId, await mkService('t7'), { status: 'paused' })).ok);
  { const r = await upd(empD.userId, await mkService('t8'), { name: 'x' }); record('T8 services:disable tenta editar campo → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  { const r = await upd(empD.userId, await mkService('t9', ServiceStatus.PAUSED), { status: 'active' }); record('T9 services:disable tenta reativar paused→active → 403 (reativar é edit)', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }

  // ── ESCOPO ERRADO / REVOGADO / CAPABILITY ERRADA ──
  await grant(empX.actorId, 'services:edit', owner.actorId); // escopo errado (actor do owner)
  { const r = await upd(empX.userId, await mkService('t11'), { name: 'x' }); record('T11 escopo errado → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  await actorCapabilityGrantService.revoke(TENANT_ID, gEdit.grantId, { userId: owner.userId, actorId: owner.actorId }, 'e2e revoke');
  { const r = await upd(emp.userId, await mkService('t12'), { name: 'x' }); record('T12 grant revogado → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  await grant(empX.actorId, 'services:create'); // capability errada p/ editar
  { const r = await upd(empX.userId, await mkService('t13'), { name: 'x' }); record('T13 capability errada (services:create) edita → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }

  // ── PAYLOAD MISTO (edit + pause) ──
  { const r = await upd(empD.userId, await mkService('t14'), { name: 'x', status: 'paused' }); record('T14 misto edit+pause com só services:disable → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  await grant(emp.actorId, 'services:edit'); // re-concede edit ao emp (foi revogado em T12)
  { const r = await upd(emp.userId, await mkService('t15'), { name: 'x', status: 'paused' }); record('T15 misto edit+pause com só services:edit → 403', !r.ok && isAuthDenial(r.err?.msg), r.err?.msg); }
  await grant(empB.actorId, 'services:edit'); await grant(empB.actorId, 'services:disable');
  record('T16 misto edit+pause com services:edit + services:disable → OK', (await upd(empB.userId, await mkService('t16'), { name: 'Misto', status: 'paused' })).ok);

  // ── grant NÃO bypassa gate semântico/operacional ──
  { const r = await upd(emp.userId, await mkService('t17'), { categoryId: nonServicosCat }); record('T17 grant NÃO bypassa gate de categoria (categoria não-servicos bloqueia NO GATE, não na autoridade)', !r.ok && !isAuthDenial(r.err?.msg), `code=${r.err?.code} msg=${r.err?.msg}`); }

  // ── grant NÃO troca dono/provider/tenant/concept (estrutural) ──
  {
    const sid = await mkService('t18');
    await upd(emp.userId, sid, { name: 'Mantém Dono' });
    const row = (await pool.query<{ a: string }>(`SELECT actor_id::text AS a FROM services WHERE service_id=$1`, [sid])).rows[0];
    record('T18 grant não troca actor_id/dono (UpdateServiceInput não expõe actor/tenant/concept — estrutural)', row?.a === scope, `actor_id=${row?.a}`);
  }

  // ── referral fora (grant por actor_id) ──
  {
    const row = (await pool.query<{ g: string; s: string }>(`SELECT grantee_actor_id::text AS g, scope_actor_id::text AS s FROM actor_capability_grants WHERE grant_id=$1`, [gEdit.grantId])).rows[0];
    record('T19 grant persiste actor_id (grantee/scope), nunca referral/slug', row?.g === emp.actorId && row?.s === scope, JSON.stringify(row));
  }

  // ── financeiro/tempo ──
  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`);
  record('T20 Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  const availAfter = await count(`SELECT (SELECT count(*) FROM availability)::int AS n`);
  const schedAfter = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);
  record('T21 zero availability/schedules tocados', availAfter === availBefore && schedAfter === schedBefore, `avail ${availBefore}->${availAfter} sched ${schedBefore}->${schedAfter}`);

  // ── services:create continua intacto sob a mesma composição ──
  {
    const empC = await seedCivilActor(TENANT_ID, 'OpCreate');
    await grant(empC.actorId, 'services:create');
    const canon = await mkCanonical(TENANT_ID, publishedConcept, 't22');
    let ok = false; let msg = '';
    try { const s = await servicesService.createService(TENANT_ID, empC.userId, { actorId: scope, name: 'Svc t22', categoryId, canonicalServiceId: canon, serviceType: ServiceType.SERVICE }); ok = !!s.serviceId; }
    catch (e) { msg = errOf(e).msg; }
    record('T22 services:create continua intacto (grant cria) — não regrediu', ok, msg);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ services:edit/disable enforceados (aditivo, fail-closed); misto exige ambas; disable não edita; edit não pausa; reativar=edit; sem wildcard; referral fora; Δbank=0.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
