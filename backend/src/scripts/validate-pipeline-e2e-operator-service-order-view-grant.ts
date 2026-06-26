/**
 * E2E F-OPERATOR-SERVICE-ORDER-VIEW-GRANT — LEITURA operacional de ordem de serviço por capability.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-operator-service-order-view-grant-ephemeral.ps1.
 *
 * Prova a menor fatia material segura da operação empresarial por capability: um operador/membro com grant
 * explícito `service_order:view` consegue VER ordem de serviço daquele provider/actor — SEM virar owner, SEM
 * canRepresentActor global, SEM referral, SEM global admin e SEM tocar dinheiro. A autoridade de leitura vive
 * no SERVICE layer (serviceOrderService.canViewOrderForParty), composta ADITIVA e FAIL-CLOSED:
 *
 *   ALLOW se (A) canRepresentActor(user, partyActor)  OU  (B) hasCapabilityGrant(grantee, 'service_order:view', partyActor)
 *   else → NÃO lê (false).
 *
 * O grant é ESCOPADO ao actor-parte (provider/worker da ordem) e ADITIVO: autoriza só LEITURA, NESTE escopo;
 * NÃO vira represent global, NÃO substitui owner, NÃO concede write/status, NÃO toca Bank. Revogação remove o
 * acesso. Cenário: 2 empresas PJ publicadas/operacionais; 1 ordem real bound ao provider da Empresa A; um
 * OPERADOR funcionário (user-actor SEM membership) que recebe o grant escopado ao provider A; um operador de
 * OUTRA empresa (B) com grant escopado ao provider B. Money-free; Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor, ensurePageActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOrderService } from '../modules/services/service-order.service';
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
  if (!/capability|grant|slice|service|order|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

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
    [id, tenantId, conceptId, `Canonical ${label}`, `canon-${label}-${id.slice(0, 8)}`]
  );
  return id;
}

/** Cria empresa PJ publicada/operacional + page-actor + owner com membership. Reusa a espinha selada. */
async function seedPublishedCompany(
  tenantId: string, companyTypeId: string, categoryId: string, publishedConcept: string, label: string
): Promise<{ owner: { userId: string; actorId: string; globalUserId: string }; companyId: string; pageActor: string }> {
  const owner = await seedCivilActor(tenantId, `Owner${label}`);
  const cnpj = String(Date.now() + (seq += 1)).padStart(14, '0').slice(-14);
  const fiscalId = (await pool.query<{ f: string }>(
    `INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,'approved',$2::uuid, now()) RETURNING fiscal_identity_id::text AS f`,
    [cnpj, owner.actorId]
  )).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1::uuid,$2,$3::uuid) RETURNING company_id::text AS c`,
    [tenantId, `${label} Provider LTDA`, fiscalId]
  )).rows[0].c;
  const pageActor = await ensurePageActor(tenantId, companyId, owner.actorId);
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(tenantId, pageActor.actor_id, 'company', 'companies', companyId);
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`,
    [tenantId, companyId, owner.globalUserId]
  );
  await companiesService.activateCompanyOperationally({ tenantId, companyId, responsibleUserId: owner.userId, primaryCompanyTypeId: companyTypeId, primaryConceptId: publishedConcept });
  await companyPublicationsService.publishCompanyConcept({ tenantId, companyId, responsibleUserId: owner.userId, globalUserId: owner.globalUserId, conceptId: publishedConcept });
  return { owner, companyId, pageActor: pageActor.actor_id };
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Operator Service Order View Grant', slug: `osovg-${Date.now()}` });

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

  // ── Empresa A (provider da ordem) + Empresa B (outra empresa) ──
  const A = await seedPublishedCompany(TENANT_ID, companyTypeId, categoryId, publishedConcept, 'EmpresaA');
  const B = await seedPublishedCompany(TENANT_ID, companyTypeId, categoryId, publishedConcept, 'EmpresaB');

  // ── Serviço REAL da Empresa A (provider = page-actor A) ──
  const canonA = await mkCanonical(TENANT_ID, publishedConcept, 'svcA');
  await servicesService.createService(TENANT_ID, A.owner.userId, {
    actorId: A.pageActor, name: 'Serviço A', categoryId, canonicalServiceId: canonA, serviceType: ServiceType.SERVICE,
  });
  const serviceId = (await pool.query<{ s: string }>(
    `SELECT service_id::text AS s FROM services WHERE tenant_id=$1::uuid AND actor_id=$2::uuid ORDER BY created_at DESC LIMIT 1`,
    [TENANT_ID, A.pageActor]
  )).rows[0].s;

  // ── Cliente + ORDEM real: worker=page-actor A (provider), customer=cliente ──
  const customer = await seedCivilActor(TENANT_ID, 'ClienteHumano');
  const orderId = (await pool.query<{ o: string }>(
    `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, status, scheduled_start, scheduled_end, created_by_actor_id)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'draft', now() + interval '1 day', now() + interval '1 day 1 hour', $5::uuid) RETURNING id::text AS o`,
    [TENANT_ID, serviceId, A.pageActor, customer.actorId, A.owner.actorId]
  )).rows[0].o;

  // OPERADORES funcionários: user-actor SEM membership (não representam page-actor).
  const operatorA = await seedCivilActor(TENANT_ID, 'OperadorA');   // receberá grant na Empresa A
  const operatorB = await seedCivilActor(TENANT_ID, 'OperadorB');   // membro/operador da Empresa B (escopo errado p/ A)

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );

  // ── T0 — a ordem nasceu bound ao provider A (worker) e ao cliente (customer) ──
  {
    const row = (await pool.query<{ w: string; c: string }>(
      `SELECT worker_actor_id::text AS w, customer_actor_id::text AS c FROM service_orders WHERE id=$1::uuid`, [orderId]
    )).rows[0];
    record('T0 ordem real bound ao provider A (worker) e ao cliente (customer)',
      row?.w === A.pageActor && row?.c === customer.actorId, JSON.stringify(row));
  }

  // ── T1 — OWNER da Empresa A lê (canRepresentActor preservado; sem grant) ──
  record('T1 owner A lê ordem do provider A (canRepresentActor nativo)',
    await serviceOrderService.canViewOrderForParty(TENANT_ID, A.owner.userId, A.pageActor), 'owner deveria ler');

  // ── T2 — OPERADOR sem grant → NÃO lê (sem representação, sem capability) ──
  record('T2 operador SEM grant → NÃO lê (sem representação, sem capability)',
    !(await serviceOrderService.canViewOrderForParty(TENANT_ID, operatorA.userId, A.pageActor)), 'sem grant não deveria ler');

  // ── T3 — GRANT service_order:view ao operador (escopo=provider A); operador COM grant LÊ ──
  let grantId = '';
  {
    const g = await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: operatorA.actorId, capabilityKey: 'service_order:view', scopeActorId: A.pageActor,
      grantedByUserId: A.owner.userId, grantedByActorId: A.owner.actorId,
    });
    grantId = g.grantId;
    record('T3a grant gravado por actor_id (grantee=operador, scope=provider A; não slug/referral)',
      g.granteeActorId === operatorA.actorId && g.scopeActorId === A.pageActor && g.status === 'active', `grantee=${g.granteeActorId} scope=${g.scopeActorId}`);
    record('T3b operador COM grant service_order:view LÊ ordem do provider A (grant MORDE; aditivo)',
      await serviceOrderService.canViewOrderForParty(TENANT_ID, operatorA.userId, A.pageActor), 'grant deveria autorizar leitura');
  }

  // ── T4 — OUTRA EMPRESA: operador B com grant escopado ao provider B NÃO lê ordem do provider A ──
  {
    await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: operatorB.actorId, capabilityKey: 'service_order:view', scopeActorId: B.pageActor,
      grantedByUserId: B.owner.userId, grantedByActorId: B.owner.actorId,
    });
    record('T4 operador de OUTRA empresa (grant escopo B) → NÃO lê ordem do provider A (escopo vinculante)',
      !(await serviceOrderService.canViewOrderForParty(TENANT_ID, operatorB.userId, A.pageActor)), 'escopo B não pode ler provider A');
  }

  // ── T5 — CAPABILITY ERRADA: grant services:create NÃO autoriza leitura de ordem ──
  {
    await actorCapabilityGrantService.grant(TENANT_ID, {
      granteeActorId: operatorB.actorId, capabilityKey: 'services:create', scopeActorId: A.pageActor, // capability errada, escopo A
      grantedByUserId: A.owner.userId, grantedByActorId: A.owner.actorId,
    });
    record('T5 grant de CAPABILITY ERRADA (services:create) → NÃO lê (match de capability EXATO)',
      !(await serviceOrderService.canViewOrderForParty(TENANT_ID, operatorB.userId, A.pageActor)), 'services:create não é service_order:view');
  }

  // ── T6 — REVOGA o grant do operador A → volta a NÃO ler ──
  {
    await actorCapabilityGrantService.revoke(TENANT_ID, grantId, { userId: A.owner.userId, actorId: A.owner.actorId }, 'e2e revoke');
    record('T6 grant revogado → operador A NÃO lê (capability deixa de morder)',
      !(await serviceOrderService.canViewOrderForParty(TENANT_ID, operatorA.userId, A.pageActor)), 'revogado não deveria ler');
  }

  // ── T7 — REFERRAL fora: grant persiste actor_id (grantee/scope), nunca referral/slug ──
  {
    const row = (await pool.query<{ grantee: string; scope: string; cap: string }>(
      `SELECT grantee_actor_id::text AS grantee, scope_actor_id::text AS scope, capability_key AS cap FROM actor_capability_grants WHERE grant_id=$1`, [grantId]
    )).rows[0];
    record('T7 grant persiste actor_id + capability service_order:view (nunca referral/slug)',
      row?.grantee === operatorA.actorId && row?.scope === A.pageActor && row?.cap === 'service_order:view', JSON.stringify(row));
  }

  // ── T8 — FINANCEIRO: Δbank=0 (nenhuma escrita financeira em todo o fluxo de leitura/grant) ──
  const bankAfter = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );
  record('T8 Δbank=0 (leitura por capability é money-free)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

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
  console.log('✨ service_order:view enforceado por grant ativo+escopado (aditivo, fail-closed, só leitura); owner/canRepresentActor preservado; outra empresa/capability errada/revogado NÃO leem; Δbank=0.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
