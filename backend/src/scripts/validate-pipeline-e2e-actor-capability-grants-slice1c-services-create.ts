/**
 * E2E F-ACTOR-CAPABILITY-GRANTS-MVP — SLICE 1C ENFORCEMENT MÍNIMO (services:create).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-actor-capability-grants-slice1c-services-create-ephemeral.ps1.
 *
 * Faz a permissão MORDER uma ação real, pequena e NÃO-financeira: a capability `services:create` passa a
 * autorizar a criação de serviço no escopo de uma empresa/page-actor, via composição FAIL-CLOSED em
 * servicesService.createService (DECISION-0136/0138):
 *
 *   ALLOW se (A/B) canRepresentActor(user, actor-alvo)  OU  (C) hasCapabilityGrant(grantee, 'services:create', scope)
 *   else → 403 SERVICE_ACTOR_NOT_REPRESENTABLE
 *
 * O grant é ADITIVO e ESCOPADO: autoriza só ESTA ação NESTE escopo; NÃO vira canRepresentActor global,
 * NÃO substitui owner, e NÃO bypassa os gates semânticos (categoria/ramo, concept, declaração/publicação PJ,
 * company operacional). Referral/código de indicação NUNCA participa (grantee/escopo são actor_id server-side).
 *
 * Cenário: empresa PJ publicada/operacional/KYB-approved (provider PJ, reuso da espinha selada) +
 * um OPERADOR funcionário (user-actor SEM membership) que recebe o grant. Money-free; Δbank=0;
 * zero availability/schedules; nenhum gate semântico bypassado.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor, ensurePageActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
import { servicesService } from '../modules/services/services.service';
import { ServiceType } from '../modules/services/services.types';
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
  if (!/capability|grant|slice|services|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: unknown): { code?: string; msg: string } => ({ code: (e as { code?: string })?.code, msg: e instanceof Error ? e.message : String(e) });

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

/** Cria um canonical_service ACTIVE (scoped) para um concept (concept já deve existir/seedado). */
async function mkCanonical(tenantId: string, conceptId: string, label: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status)
       VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`,
    [id, tenantId, conceptId, `Canonical ${label}`, `canon-${label}-${id.slice(0, 8)}`]
  );
  return id;
}

async function createServiceAttempt(tenantId: string, userId: string, actorId: string, canonicalId: string, categoryId: string, name: string): Promise<{ ok: boolean; err?: { code?: string; msg: string } }> {
  try {
    await servicesService.createService(tenantId, userId, {
      actorId, name, categoryId, canonicalServiceId: canonicalId, serviceType: ServiceType.SERVICE,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: errOf(e) };
  }
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Capability Grants Slice 1C', slug: `cg1c-${Date.now()}` });

  // triple coerente do catálogo FULL (company_type × concept permitido × categoria servicos na ponte).
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

  // ── EMPRESA PJ publicada/operacional/KYB-approved (reuso da espinha selada) ──
  const owner = await seedCivilActor(TENANT_ID, 'OwnerHumano');
  const cnpj = String(Date.now() + (seq += 1)).padStart(14, '0').slice(-14);
  const fiscalId = (await pool.query<{ f: string }>(
    `INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,'approved',$2::uuid, now()) RETURNING fiscal_identity_id::text AS f`,
    [cnpj, owner.actorId]
  )).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1::uuid,$2,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, 'Slice1C Provider LTDA', fiscalId]
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

  const scopeActor = pageActor.actor_id; // escopo do grant = page-actor da empresa
  const canonOwner = await mkCanonical(TENANT_ID, publishedConcept, 'owner');
  const canonEmp = await mkCanonical(TENANT_ID, publishedConcept, 'emp');

  // OPERADOR funcionário: user-actor SEM membership na empresa (não representa o page-actor).
  const employee = await seedCivilActor(TENANT_ID, 'OperadorFuncionario');
  const employee2 = await seedCivilActor(TENANT_ID, 'OperadorFuncionario2');

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );
  const availBefore = await count(`SELECT (SELECT count(*) FROM availability)::int AS n`);
  const schedBefore = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);

  // ── T1 — OWNER continua criando serviço (caminho canRepresentActor preservado) ──
  {
    const r = await createServiceAttempt(TENANT_ID, owner.userId, scopeActor, canonOwner, categoryId, 'Owner Service');
    record('T1 owner cria serviço no escopo da empresa (canRepresentActor preservado)', r.ok, r.err?.msg);
  }

  // ── T2 — FUNCIONÁRIO SEM grant → 403 (sem canRepresentActor, sem grant) ──
  {
    const r = await createServiceAttempt(TENANT_ID, employee.userId, scopeActor, canonEmp, categoryId, 'Emp NoGrant');
    record('T2 funcionário SEM grant → 403 (sem representação, sem capability)',
      !r.ok && r.err?.code === 'FORBIDDEN' && /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(r.err?.msg || ''), `code=${r.err?.code} msg=${r.err?.msg}`);
  }

  // ── T3 — GRANT services:create ao funcionário (escopo=page-actor); funcionário COM grant cria ──
  let grantId = '';
  {
    const g = await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: employee.actorId, capabilityKey: 'services:create', scopeActorId: scopeActor,
      grantedByUserId: owner.userId, grantedByActorId: owner.actorId, eventReason: 'e2e T3a',
    });
    grantId = g.grantId;
    record('T3a grant gravado por actor_id (grantee=funcionário, scope=page-actor; não slug/referral)',
      g.granteeActorId === employee.actorId && g.scopeActorId === scopeActor && g.status === 'active', `grantee=${g.granteeActorId} scope=${g.scopeActorId}`);
    const r = await createServiceAttempt(TENANT_ID, employee.userId, scopeActor, canonEmp, categoryId, 'Emp WithGrant');
    record('T3b funcionário COM grant services:create cria serviço no escopo (grant MORDE; aditivo)', r.ok, r.err?.msg);
  }

  // ── T4 — REVOGA o grant → funcionário volta a 403 ──
  {
    await actorCapabilityGrantService.revoke(TENANT_ID, grantId, { userId: owner.userId, actorId: owner.actorId }, 'e2e revoke');
    const r = await createServiceAttempt(TENANT_ID, employee.userId, scopeActor, await mkCanonical(TENANT_ID, publishedConcept, 'rev'), categoryId, 'Emp Revoked');
    record('T4 grant revogado → funcionário 403 (capability deixa de morder)',
      !r.ok && /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(r.err?.msg || ''), `msg=${r.err?.msg}`);
  }

  // ── T5 — ESCOPO ERRADO: grant scoped a OUTRO actor não autoriza no escopo do page-actor ──
  {
    await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: employee2.actorId, capabilityKey: 'services:create', scopeActorId: owner.actorId, // escopo = actor do owner (errado)
      grantedByUserId: owner.userId, grantedByActorId: owner.actorId, eventReason: 'e2e T5',
    });
    const r = await createServiceAttempt(TENANT_ID, employee2.userId, scopeActor, await mkCanonical(TENANT_ID, publishedConcept, 'wscope'), categoryId, 'Emp2 WrongScope');
    record('T5 grant em ESCOPO ERRADO → 403 (escopo é vinculante)',
      !r.ok && /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(r.err?.msg || ''), `msg=${r.err?.msg}`);
  }

  // ── T6 — CAPABILITY ERRADA: grant services:edit não autoriza services:create ──
  {
    await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: employee.actorId, capabilityKey: 'services:edit', scopeActorId: scopeActor, // capability errada
      grantedByUserId: owner.userId, grantedByActorId: owner.actorId, eventReason: 'e2e T6',
    });
    const r = await createServiceAttempt(TENANT_ID, employee.userId, scopeActor, await mkCanonical(TENANT_ID, publishedConcept, 'wcap'), categoryId, 'Emp WrongCap');
    record('T6 grant de CAPABILITY ERRADA (services:edit) → 403 p/ services:create',
      !r.ok && /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(r.err?.msg || ''), `msg=${r.err?.msg}`);
  }

  // ── T7 — GRANT NÃO BYPASSA gates semânticos: concept NÃO publicado pela empresa → falha NO GATE, não na autoridade ──
  {
    // re-concede services:create válido ao funcionário (escopo correto), mas aponta p/ concept NÃO publicado.
    await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: employee.actorId, capabilityKey: 'services:create', scopeActorId: scopeActor,
      grantedByUserId: owner.userId, grantedByActorId: owner.actorId, eventReason: 'e2e T7',
    });
    // concept governado NOVO, NÃO publicado pela empresa:
    const unpubConcept = randomUUID();
    const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      await gc.query(`INSERT INTO concepts (concept_id, slug, domain) VALUES ($1::uuid,$2,'servicos')`, [unpubConcept, `unpub-${unpubConcept.slice(0, 8)}`]);
      await gc.query('COMMIT');
    } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); }
    const canonUnpub = await mkCanonical(TENANT_ID, unpubConcept, 'unpub');
    const r = await createServiceAttempt(TENANT_ID, employee.userId, scopeActor, canonUnpub, categoryId, 'Emp Unpublished');
    // autoridade PASSOU (grant), mas a DECLARAÇÃO/PUBLICAÇÃO PJ do concept bloqueia → NÃO é o 403 de autoridade.
    record('T7 grant NÃO bypassa gate semântico (concept não publicado → bloqueia no gate, não na autoridade)',
      !r.ok && !/SERVICE_ACTOR_NOT_REPRESENTABLE/.test(r.err?.msg || ''), `code=${r.err?.code} msg=${r.err?.msg}`);
  }

  // ── T8 — REFERRAL fora: o grant é por actor_id; nenhuma coluna referral participa ──
  {
    const row = (await pool.query<{ grantee: string; scope: string }>(
      `SELECT grantee_actor_id::text AS grantee, scope_actor_id::text AS scope FROM actor_capability_grants WHERE grant_id=$1`, [grantId]
    )).rows[0];
    record('T8 grant persiste actor_id (grantee/scope), nunca referral/slug', row?.grantee === employee.actorId && row?.scope === scopeActor, JSON.stringify(row));
  }

  // ── T9 — FINANCEIRO: Δbank=0 + zero availability/schedules ──
  const bankAfter = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );
  record('T9 Δbank=0 (nenhuma escrita financeira)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  const availAfter = await count(`SELECT (SELECT count(*) FROM availability)::int AS n`);
  const schedAfter = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);
  record('T10 zero toque em availability/schedules (SSOT temporal lacrado intocado)', availAfter === availBefore && schedAfter === schedBefore, `avail ${availBefore}->${availAfter} sched ${schedBefore}->${schedAfter}`);

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
  console.log('✨ services:create enforceado por capability grant ativo+escopado (aditivo, fail-closed); owner/canRepresentActor preservados; gates semânticos não bypassados; Δbank=0.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
