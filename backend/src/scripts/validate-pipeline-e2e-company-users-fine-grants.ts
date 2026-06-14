/**
 * E2E F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION + ESCOPO (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-company-users-fine-grants-ephemeral.ps1 (cria DB, migra, roda, dropa).
 *
 * Prova: a autoridade fina é `company_users.can_*` (DECISION-0125) **COMPANY-SCOPED** — grant em UMA empresa
 * NÃO autoriza leitura tenant-wide. Sem companyId resolvível → fail-closed (company_scope_required). Rotas
 * tenant-wide = fail-closed; rotas actor-scoped resolvem actors.company_id e exigem o grant NAQUELA empresa.
 * owner/can_manage_company = supergrant SÓ dentro da empresa escopada. actorId nunca vira subject. Bank/
 * payout/trust/dispute/service-orders intocados.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { companiesService } from '../core/companies/companies.service';
import reportingRoutes from '../modules/reporting/reporting.routes';
import businessAuditRoutes from '../modules/business-audit/business-audit.routes';
import riskDashboardRoutes from '../modules/risk-command-center/risk-dashboard.routes';
import policyRoutes from '../modules/policy-engine/policy.routes';

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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/grant|fine|r2|spoof|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);

let seq = 0;
async function mkUser(tenantId: string, name: string): Promise<{ userId: string; gu: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, gu, actorId };
}

// company-actor (actor_type='company' com company_id) → alvo cujo company resolve via actors.company_id.
// §4.8 LEI_COERENCIA: actor não-humano requer responsible_actor_id → criamos um actor responsável (founder).
async function mkCompany(tenantId: string, name: string): Promise<{ companyId: string; companyActorId: string }> {
  const founder = await mkUser(tenantId, `${name}-founder`);
  const companyId = (await pool.query<{ id: string }>(
    `INSERT INTO companies (tenant_id, company_name, status, company_status) VALUES ($1::uuid,$2,'active','ACTIVE') RETURNING company_id::text AS id`,
    [tenantId, name],
  )).rows[0].id;
  const companyActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'company',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, `${name} PageActor`, companyId, founder.actorId],
  )).rows[0].id;
  return { companyId, companyActorId };
}

async function addMembership(tenantId: string, companyId: string, gu: string, grants: Record<string, boolean>, role = 'staff'): Promise<void> {
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, can_view_reports, can_view_audit_logs, can_view_risk, can_manage_risk, can_manage_policy, is_active, is_primary, member_status, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,true,false,'active','{}'::jsonb)`,
    [tenantId, companyId, gu, role,
      grants.can_manage_company === true, grants.can_view_reports === true, grants.can_view_audit_logs === true,
      grants.can_view_risk === true, grants.can_manage_risk === true, grants.can_manage_policy === true],
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── T1 — migration aplicada: 4 colunas can_* novas existem em company_users ──
  const cols = (await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='company_users' AND column_name = ANY($1)`,
    [['can_view_audit_logs', 'can_view_risk', 'can_manage_risk', 'can_manage_policy']],
  )).rows.map((r) => r.column_name).sort();
  record('T1 migration: company_users.{can_view_audit_logs,can_view_risk,can_manage_risk,can_manage_policy} existem', cols.length === 4, `cols=${cols.join(',')}`);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'R2 Scope', slug: `r2s-${Date.now()}` });
  const A = await mkCompany(TENANT_ID, 'CompanyA');
  const B = await mkCompany(TENANT_ID, 'CompanyB');
  const userActorNoCompany = (await mkUser(TENANT_ID, 'PlainUserActor')).actorId; // actor sem company_id

  const aRisk = await mkUser(TENANT_ID, 'A_Risk');     await addMembership(TENANT_ID, A.companyId, aRisk.gu, { can_view_risk: true });
  const aAudit = await mkUser(TENANT_ID, 'A_Audit');   await addMembership(TENANT_ID, A.companyId, aAudit.gu, { can_view_audit_logs: true });
  const aPolicy = await mkUser(TENANT_ID, 'A_Policy'); await addMembership(TENANT_ID, A.companyId, aPolicy.gu, { can_manage_policy: true });
  const aOwner = await mkUser(TENANT_ID, 'A_Owner');   await addMembership(TENANT_ID, A.companyId, aOwner.gu, {}, 'owner');
  const aNone = await mkUser(TENANT_ID, 'A_None');     await addMembership(TENANT_ID, A.companyId, aNone.gu, {});
  const stranger = await mkUser(TENANT_ID, 'Stranger'); // sem vínculo

  // ── T-PRIM — checagem DIRETA do primitivo: fail-closed sem companyId; scoped com companyId ──
  {
    const noScope = await companiesService.canUserPerformCompanyCapability(TENANT_ID, aRisk.userId, 'can_view_risk');
    const scopedA = await companiesService.canUserPerformCompanyCapability(TENANT_ID, aRisk.userId, 'can_view_risk', { companyId: A.companyId });
    const scopedB = await companiesService.canUserPerformCompanyCapability(TENANT_ID, aRisk.userId, 'can_view_risk', { companyId: B.companyId });
    record('T-PRIM primitivo: sem companyId → company_scope_required; company A (membro) → allowed; company B (não) → no_grant_in_company',
      noScope.allowed === false && noScope.reason === 'company_scope_required' && scopedA.allowed === true && scopedB.allowed === false && scopedB.reason === 'no_grant_in_company',
      `noScope=${JSON.stringify(noScope)} A=${JSON.stringify(scopedA)} B=${JSON.stringify(scopedB)}`);
  }

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = uid ? { id: uid, userId: uid } : null;
    req.tenant = { id: TENANT_ID };
    const declared = req.headers['x-test-actor-id'];
    req.actionContext = declared ? { actorId: declared, intent: 'view', scope: 'admin' } : { actorId: undefined };
  });
  await app.register(reportingRoutes);
  await app.register(businessAuditRoutes);
  await app.register(riskDashboardRoutes);
  await app.register(policyRoutes);
  await app.ready();

  const get = (url: string, userId?: string, actorId?: string) =>
    app.inject({ method: 'GET', url, headers: { ...(userId ? { 'x-test-user-id': userId } : {}), ...(actorId ? { 'x-test-actor-id': actorId } : {}) } });
  // Régua AUTORIDADE: gate ou NEGA (401/403) ou CONCEDE (alcança o handler). 500 por tabela latente ausente
  // é DOWNSTREAM do gate (prova que autorizou). passedGate = ≠401/403.
  const passedGate = (s: number): boolean => s !== 401 && s !== 403;
  const scopeRequired = async (r: any): Promise<boolean> => { const b = JSON.parse(r.body || '{}'); return r.statusCode === 403 && b.code === 'COMPANY_SCOPE_REQUIRED'; };

  // ── T2 — risk actor-scoped: membro de A com can_view_risk acessa /actors/<companyActorA> → passa gate ──
  record('T2 risk /actors/:companyActorA — membro A com can_view_risk → AUTORIZADO (gate concede)',
    passedGate((await get(`/risk/dashboard/actors/${A.companyActorId}`, aRisk.userId)).statusCode));
  // ── T3 — cross-company: membro de A tenta /actors/<companyActorB> → 403 ──
  record('T3 risk /actors/:companyActorB — membro A tentando empresa B → 403 (cross-company negado)',
    (await get(`/risk/dashboard/actors/${B.companyActorId}`, aRisk.userId)).statusCode === 403);
  // ── T4 — tenant-wide: risk overview sem company scope → 403 COMPANY_SCOPE_REQUIRED ──
  record('T4 risk /overview tenant-wide sem company scope → 403 COMPANY_SCOPE_REQUIRED', await scopeRequired(await get('/risk/dashboard/overview', aRisk.userId, A.companyActorId)));
  // ── T5 — audit company-scoped: membro A com can_view_audit_logs, ?actorId=<companyActorA> → passa gate ──
  record('T5 audit ?actorId=companyActorA — membro A com can_view_audit_logs → AUTORIZADO',
    passedGate((await get(`/business-audit-logs?actorId=${A.companyActorId}`, aAudit.userId)).statusCode));
  // ── T6 — audit sem grant na company alvo → 403 ──
  record('T6 audit ?actorId=companyActorA — membro A SEM can_view_audit_logs → 403',
    (await get(`/business-audit-logs?actorId=${A.companyActorId}`, aNone.userId)).statusCode === 403);
  // ── T7 — risk target company com can_view_risk → passa (reforço explícito) ──
  record('T7 risk /actors/:companyActorA com can_view_risk → AUTORIZADO (company scope)',
    passedGate((await get(`/risk/dashboard/actors/${A.companyActorId}`, aRisk.userId)).statusCode));
  // ── T8 — risk tenant-wide (/actors lista) sem company scope → 403 COMPANY_SCOPE_REQUIRED ──
  record('T8 risk /actors (lista) tenant-wide → 403 COMPANY_SCOPE_REQUIRED', await scopeRequired(await get('/risk/dashboard/actors', aRisk.userId, A.companyActorId)));
  // ── T9 — policy company-scoped: /policies/evaluate/<companyActorA> com can_manage_policy → passa ──
  record('T9 policy /policies/evaluate/:companyActorA com can_manage_policy → AUTORIZADO (company scope)',
    passedGate((await get(`/policies/evaluate/${A.companyActorId}`, aPolicy.userId)).statusCode));
  // ── T10 — policy tenant-wide (/policies lista) → 403 COMPANY_SCOPE_REQUIRED ──
  record('T10 policy /policies (lista) tenant-wide → 403 COMPANY_SCOPE_REQUIRED', await scopeRequired(await get('/policies', aPolicy.userId)));
  // ── T11 — owner é supergrant SÓ dentro da empresa: owner de A acessa A, NEGA em B ──
  {
    const okA = passedGate((await get(`/risk/dashboard/actors/${A.companyActorId}`, aOwner.userId)).statusCode);
    const denyB = (await get(`/risk/dashboard/actors/${B.companyActorId}`, aOwner.userId)).statusCode === 403;
    record('T11 owner de A: acessa A (supergrant na empresa) MAS negado em B (não vira supergrant tenant-wide)', okA && denyB, `okA=${okA} denyB=${denyB}`);
  }
  // ── T12 — target actorId nunca vira subject: stranger (sem vínculo) declarando companyActorA → 403 ──
  record('T12 stranger (sem vínculo) GET /actors/:companyActorA → 403 (actorId alvo não vira subject/grant)',
    (await get(`/risk/dashboard/actors/${A.companyActorId}`, stranger.userId)).statusCode === 403);
  // ── T12b — actor-alvo sem company resolvível (user-actor sem company_id) → 403 COMPANY_SCOPE_REQUIRED ──
  record('T12b risk /actors/:userActorSemCompany → 403 COMPANY_SCOPE_REQUIRED (sem company resolvível)', await scopeRequired(await get(`/risk/dashboard/actors/${userActorNoCompany}`, aRisk.userId)));
  // ── T-reporting — reporting tenant-wide irredutível → 403 COMPANY_SCOPE_REQUIRED ──
  record('T-reporting /reporting/financial-kpis tenant-wide → 403 COMPANY_SCOPE_REQUIRED', await scopeRequired(await get('/reporting/financial-kpis', aRisk.userId)));
  await app.close();

  // ── T13 — SUBJECT_EQUALS_TARGET hard-fail no guard (estrutural) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    record('T13 guard mantém SUBJECT_EQUALS_TARGET hard-fail (anti-spoof)', /SUBJECT_EQUALS_TARGET\s*=\s*\/requirePermission/.test(guard));
  }
  // ── T14 — bank-http/payout/trust baselineados e intocados (estrutural) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const pay = readFileSync(join(process.cwd(), 'src/modules/payout/payout.routes.ts'), 'utf-8');
    const bank = readFileSync(join(process.cwd(), 'src/core/unifybank/bank-http.routes.ts'), 'utf-8');
    const trust = readFileSync(join(process.cwd(), 'src/modules/trust/trust.routes.ts'), 'utf-8');
    const baselined = /bank-http\.routes\.ts/.test(guard) && /payout\.routes\.ts/.test(guard) && /trust\.routes\.ts/.test(guard);
    const untouched = !/canUserPerformCompanyCapability/.test(pay) && !/canUserPerformCompanyCapability/.test(bank) && !/canUserPerformCompanyCapability/.test(trust) && /'financial:execute_payout'/.test(pay);
    record('T14 bank-http+payout+trust baselineados no guard + sem nova primitive (hard-stop/interino intocado)', baselined && untouched, `baselined=${baselined} untouched=${untouched}`);
  }
  // ── T15 — dispute/reversal contidos (estrutural) ──
  record('T15 dispute/reversal HTTP contido (DISPUTE_REVERSAL_HTTP_DISABLED)',
    readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8').includes('DISPUTE_REVERSAL_HTTP_DISABLED'));
  // ── T16 — POST /service-orders contido (estrutural) ──
  record('T16 POST /service-orders contido (SERVICE_ORDER_DIRECT_CREATE_DISABLED)',
    readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8').includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED'));
  // ── T17 — Bank intocado ──
  record('T17 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ R2 fine-grants COMPANY-SCOPED: grant per-empresa; sem companyId → fail-closed; tenant-wide → company_scope_required; owner não vira supergrant tenant-wide; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
