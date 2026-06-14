/**
 * E2E R2 GRANTS — company-scoped (DECISION-0125) + tenant-level (DECISION-0126).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-company-users-fine-grants-ephemeral.ps1 (cria DB, migra, roda, dropa).
 *
 * Prova: (1) `company_users.can_*` é COMPANY-SCOPED e NUNCA autoriza tenant-wide; (2) as superfícies
 * tenant-wide (reporting / risk overview-list / business-audit sem actor / policy tenant) abrem SOMENTE por
 * `tenant_operator_grants.can_*` (DECISION-0126); (3) grant tenant A não vale tenant B; (4) rotas actor-scoped
 * continuam company-scoped (não viram tenant-only); (5) SUBJECT sempre server-side, actorId nunca subject;
 * (6) Bank/payout/trust/dispute/service-orders intocados.
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
import trustRoutes from '../modules/trust/trust.routes';

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

async function mkCompany(tenantId: string, name: string): Promise<{ companyId: string; companyActorId: string }> {
  const founder = await mkUser(tenantId, `${name}-founder`);
  const companyId = (await pool.query<{ id: string }>(
    `INSERT INTO companies (tenant_id, company_name, status, company_status) VALUES ($1::uuid,$2,'active','ACTIVE') RETURNING company_id::text AS id`, [tenantId, name],
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
    [tenantId, companyId, gu, role, grants.can_manage_company === true, grants.can_view_reports === true, grants.can_view_audit_logs === true, grants.can_view_risk === true, grants.can_manage_risk === true, grants.can_manage_policy === true],
  );
}

async function addTenantGrant(tenantId: string, gu: string, grants: Record<string, boolean>): Promise<void> {
  await pool.query(
    `INSERT INTO tenant_operator_grants (tenant_id, global_user_id, can_view_tenant_reports, can_view_tenant_audit_logs, can_view_tenant_risk, can_manage_tenant_policy, can_view_tenant_trust, can_manage_tenant_trust, is_active)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,true)`,
    [tenantId, gu, grants.can_view_tenant_reports === true, grants.can_view_tenant_audit_logs === true, grants.can_view_tenant_risk === true, grants.can_manage_tenant_policy === true, grants.can_view_tenant_trust === true, grants.can_manage_tenant_trust === true],
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── T1 — migration tenant_operator_grants aplicada (tabela + colunas) ──
  const tcols = (await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='tenant_operator_grants' AND column_name = ANY($1)`,
    [['can_view_tenant_reports', 'can_view_tenant_audit_logs', 'can_view_tenant_risk', 'can_manage_tenant_policy']],
  )).rows.map((r) => r.column_name).sort();
  record('T1 migration: tenant_operator_grants existe c/ can_view_tenant_{reports,audit_logs,risk}+can_manage_tenant_policy', tcols.length === 4, `cols=${tcols.join(',')}`);

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'Tenant A', slug: `ta-${Date.now()}` });
  await tenantService.createTenant({ id: TENANT_B, name: 'Tenant B', slug: `tb-${Date.now()}` });
  const A = await mkCompany(TENANT_A, 'CompanyA');
  const userActorNoCompany = (await mkUser(TENANT_A, 'PlainUserActor')).actorId;

  // tenant-level operators (tenant A)
  const tReports = await mkUser(TENANT_A, 'T_Reports'); await addTenantGrant(TENANT_A, tReports.gu, { can_view_tenant_reports: true });
  const tRisk = await mkUser(TENANT_A, 'T_Risk');       await addTenantGrant(TENANT_A, tRisk.gu, { can_view_tenant_risk: true });
  const tAudit = await mkUser(TENANT_A, 'T_Audit');     await addTenantGrant(TENANT_A, tAudit.gu, { can_view_tenant_audit_logs: true });
  const tPolicy = await mkUser(TENANT_A, 'T_Policy');   await addTenantGrant(TENANT_A, tPolicy.gu, { can_manage_tenant_policy: true });
  const tTrustView = await mkUser(TENANT_A, 'T_TrustView');   await addTenantGrant(TENANT_A, tTrustView.gu, { can_view_tenant_trust: true });
  const tTrustManage = await mkUser(TENANT_A, 'T_TrustManage'); await addTenantGrant(TENANT_A, tTrustManage.gu, { can_manage_tenant_trust: true });
  // company-level members (tenant A) — para preservação company-scoped
  const cRisk = await mkUser(TENANT_A, 'C_Risk');       await addMembership(TENANT_A, A.companyId, cRisk.gu, { can_view_risk: true });
  const cAudit = await mkUser(TENANT_A, 'C_Audit');     await addMembership(TENANT_A, A.companyId, cAudit.gu, { can_view_audit_logs: true });
  const cPolicy = await mkUser(TENANT_A, 'C_Policy');   await addMembership(TENANT_A, A.companyId, cPolicy.gu, { can_manage_policy: true });
  // membro de A com TODOS os company grants mas SEM tenant grant — prova que company nunca abre tenant-wide
  const cAll = await mkUser(TENANT_A, 'C_All');         await addMembership(TENANT_A, A.companyId, cAll.gu, { can_view_reports: true, can_view_audit_logs: true, can_view_risk: true, can_manage_policy: true });
  const none = await mkUser(TENANT_A, 'None');          // sem grant algum
  // tenant B operator (grant em B, NÃO em A) — cross-tenant
  const bReports = await mkUser(TENANT_B, 'B_Reports'); await addTenantGrant(TENANT_B, bReports.gu, { can_view_tenant_reports: true });

  // ── T5 (primitivo, cross-tenant) — grant em tenant B não vale tenant A ──
  {
    const inA = await companiesService.canUserPerformTenantCapability(TENANT_A, bReports.userId, 'can_view_tenant_reports');
    const inB = await companiesService.canUserPerformTenantCapability(TENANT_B, bReports.userId, 'can_view_tenant_reports');
    record('T5 tenant grant cross-tenant: operador de B → allowed em B, NEGADO em A', inB.allowed === true && inA.allowed === false, `A=${JSON.stringify(inA)} B=${JSON.stringify(inB)}`);
  }
  // ── T17 (primitivo) — company grant NUNCA autoriza tenant-wide (sem companyId → company_scope_required) ──
  {
    const companyNoScope = await companiesService.canUserPerformCompanyCapability(TENANT_A, cAll.userId, 'can_view_reports');
    const tenantNoGrant = await companiesService.canUserPerformTenantCapability(TENANT_A, cAll.userId, 'can_view_tenant_reports');
    record('T17 company grant não vira tenant: canUserPerformCompanyCapability sem companyId → company_scope_required; sem tenant grant → no_tenant_grant',
      companyNoScope.allowed === false && companyNoScope.reason === 'company_scope_required' && tenantNoGrant.allowed === false && tenantNoGrant.reason === 'no_tenant_grant');
  }

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = uid ? { id: uid, userId: uid } : null;
    req.tenant = { id: TENANT_A };
    const declared = req.headers['x-test-actor-id'];
    req.actionContext = declared ? { actorId: declared, intent: 'view', scope: 'admin' } : { actorId: undefined };
  });
  await app.register(reportingRoutes);
  await app.register(businessAuditRoutes);
  await app.register(riskDashboardRoutes);
  await app.register(policyRoutes);
  await app.register(trustRoutes);
  await app.ready();

  const get = (url: string, userId?: string, actorId?: string) =>
    app.inject({ method: 'GET', url, headers: { ...(userId ? { 'x-test-user-id': userId } : {}), ...(actorId ? { 'x-test-actor-id': actorId } : {}) } });
  const post = (url: string, userId?: string, body: any = {}) =>
    app.inject({ method: 'POST', url, headers: { ...(userId ? { 'x-test-user-id': userId } : {}) }, payload: body });
  const passedGate = (s: number): boolean => s !== 401 && s !== 403; // 500/400 downstream = passou o gate
  const denied = (s: number): boolean => s === 403;

  // ── T2 / T3 — reporting tenant-wide: sem grant → 403; com can_view_tenant_reports → passa ──
  record('T2 reporting SEM tenant grant → 403', denied((await get('/reporting/financial-kpis', none.userId)).statusCode));
  record('T3 reporting com can_view_tenant_reports → AUTORIZADO (gate concede)', passedGate((await get('/reporting/financial-kpis', tReports.userId)).statusCode));
  // ── T4 — company_users.can_view_reports SEM tenant grant → reporting tenant-wide → 403 ──
  record('T4 membro com company can_view_reports mas SEM tenant grant → reporting 403 (company não abre tenant-wide)', denied((await get('/reporting/financial-kpis', cAll.userId)).statusCode));
  // ── T6 / T7 — risk overview tenant-wide ──
  record('T6 risk /overview SEM tenant grant → 403', denied((await get('/risk/dashboard/overview', none.userId, A.companyActorId)).statusCode));
  record('T7 risk /overview com can_view_tenant_risk → AUTORIZADO', passedGate((await get('/risk/dashboard/overview', tRisk.userId, A.companyActorId)).statusCode));
  record('T7b risk /actors (lista) com can_view_tenant_risk → AUTORIZADO', passedGate((await get('/risk/dashboard/actors', tRisk.userId, A.companyActorId)).statusCode));
  // ── T8 — risk actor-scoped CONTINUA company-scoped (não vira tenant-only) ──
  {
    const companyOk = passedGate((await get(`/risk/dashboard/actors/${A.companyActorId}`, cRisk.userId)).statusCode); // company grant → ok
    const tenantGrantDenied = denied((await get(`/risk/dashboard/actors/${A.companyActorId}`, tRisk.userId)).statusCode); // tenant grant SEM company → 403
    record('T8 risk /actors/:id company-scoped: company grant passa; tenant grant (sem company) NEGADO (não regrediu p/ tenant-only)', companyOk && tenantGrantDenied, `companyOk=${companyOk} tenantGrantDenied=${tenantGrantDenied}`);
  }
  // ── T9 / T10 — business-audit tenant-wide (sem actor scope) ──
  record('T9 audit (sem actorId) SEM tenant grant → 403', denied((await get('/business-audit-logs', none.userId)).statusCode));
  record('T10 audit (sem actorId) com can_view_tenant_audit_logs → AUTORIZADO', passedGate((await get('/business-audit-logs', tAudit.userId)).statusCode));
  // ── T11 — business-audit actor-scoped CONTINUA company-scoped ──
  {
    const companyOk = passedGate((await get(`/business-audit-logs?actorId=${A.companyActorId}`, cAudit.userId)).statusCode);
    const tenantGrantDeniedOnCompanyScope = denied((await get(`/business-audit-logs?actorId=${A.companyActorId}`, tAudit.userId)).statusCode); // tenant grant não cobre company-scope
    record('T11 audit ?actorId company-scoped: company grant passa; tenant-audit grant (sem company) NEGADO no escopo company', companyOk && tenantGrantDeniedOnCompanyScope, `companyOk=${companyOk} tenantDenied=${tenantGrantDeniedOnCompanyScope}`);
  }
  // ── T12 / T13 — policy tenant-wide ──
  record('T12 policy /policies SEM tenant grant → 403', denied((await get('/policies', none.userId)).statusCode));
  record('T13 policy /policies com can_manage_tenant_policy → AUTORIZADO', passedGate((await get('/policies', tPolicy.userId)).statusCode));
  // ── T14 — policy actor-scoped CONTINUA company-scoped ──
  {
    const companyOk = passedGate((await get(`/policies/evaluate/${A.companyActorId}`, cPolicy.userId)).statusCode);
    const tenantGrantDenied = denied((await get(`/policies/evaluate/${A.companyActorId}`, tPolicy.userId)).statusCode);
    record('T14 policy /evaluate/:id company-scoped: company grant passa; tenant-policy grant (sem company) NEGADO no escopo company', companyOk && tenantGrantDenied, `companyOk=${companyOk} tenantDenied=${tenantGrantDenied}`);
  }
  // ── T15 — actorId target nunca vira subject: tenant-risk operator declarando companyActorA continua acessando
  //          /overview por GRANT (não por actorId); e none declarando actorId não ganha acesso ──
  record('T15 actorId alvo não vira subject: none declarando actorId=companyActorA em /overview → 403', denied((await get('/risk/dashboard/overview', none.userId, A.companyActorId)).statusCode));
  // ── T15b — actor-alvo sem company resolvível (user-actor) → company-scoped nega ──
  record('T15b risk /actors/:userActorSemCompany (company grant) → 403 (sem company resolvível)', denied((await get(`/risk/dashboard/actors/${userActorNoCompany}`, cRisk.userId)).statusCode));

  // ── TRUST (R2.4 UNFREEZE, DECISION-0127) — tenant-level view vs manage ──
  record('TR2 trust read SEM can_view_tenant_trust → 403', denied((await get('/trust/profiles', none.userId)).statusCode));
  record('TR3 trust read com can_view_tenant_trust → AUTORIZADO', passedGate((await get('/trust/profiles', tTrustView.userId)).statusCode));
  record('TR4 company grant (cAll) SEM tenant trust → trust read 403 (company não abre trust tenant-level)', denied((await get('/trust/profiles', cAll.userId)).statusCode));
  record('TR5 trust recalculate (mutation) SEM can_manage_tenant_trust → 403', denied((await post(`/trust/recalculate/${A.companyActorId}`, none.userId)).statusCode));
  record('TR6 trust recalculate com can_manage_tenant_trust → AUTORIZADO (gate concede)', passedGate((await post(`/trust/recalculate/${A.companyActorId}`, tTrustManage.userId)).statusCode));
  record('TR7 can_view_tenant_trust NÃO autoriza mutation: tTrustView POST /trust/recalculate → 403', denied((await post(`/trust/recalculate/${A.companyActorId}`, tTrustView.userId)).statusCode));
  record('TR9 trust actorId alvo não vira subject: none declarando /trust/profile/:actorId → 403', denied((await get(`/trust/profile/${A.companyActorId}`, none.userId)).statusCode));
  await app.close();

  // ── TR8 — grant trust tenant A não vale tenant B (primitivo) ──
  {
    const inA = await companiesService.canUserPerformTenantCapability(TENANT_A, tTrustView.userId, 'can_view_tenant_trust');
    const inB = await companiesService.canUserPerformTenantCapability(TENANT_B, tTrustView.userId, 'can_view_tenant_trust');
    record('TR8 trust grant cross-tenant: view em A → allowed; em B → negado', inA.allowed === true && inB.allowed === false, `A=${JSON.stringify(inA)} B=${JSON.stringify(inB)}`);
  }
  // ── TR1 — migration trust cols existem ──
  {
    const tc = (await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='tenant_operator_grants' AND column_name = ANY($1)`, [['can_view_tenant_trust', 'can_manage_tenant_trust']])).rows.map((r) => r.column_name).sort();
    record('TR1 migration: tenant_operator_grants.can_{view,manage}_tenant_trust existem', tc.length === 2, `cols=${tc.join(',')}`);
  }

  // ── T16 — SUBJECT_EQUALS_TARGET hard-fail no guard (estrutural) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    record('T16 guard mantém SUBJECT_EQUALS_TARGET hard-fail', /SUBJECT_EQUALS_TARGET\s*=\s*\/requirePermission/.test(guard));
  }
  // ── T18 — bank-http/payout permanecem baselineados/intocados; trust SAIU do baseline (tenant-level) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const baselineBlock = (guard.match(/const BASELINE = \{[\s\S]*?\n\};/) || [''])[0];
    const pay = readFileSync(join(process.cwd(), 'src/modules/payout/payout.routes.ts'), 'utf-8');
    const bank = readFileSync(join(process.cwd(), 'src/core/unifybank/bank-http.routes.ts'), 'utf-8');
    const trust = readFileSync(join(process.cwd(), 'src/modules/trust/trust.routes.ts'), 'utf-8');
    const bankPayoutBaselined = /bank-http\.routes\.ts/.test(baselineBlock) && /payout\.routes\.ts/.test(baselineBlock);
    const trustOutOfBaseline = !/trust\.routes\.ts/.test(baselineBlock); // trust removido do BASELINE
    const bankPayoutUntouched = ![pay, bank].some((s) => /canUserPerformTenantCapability|canUserPerformCompanyCapability/.test(s)) && /'financial:execute_payout'/.test(pay);
    const trustNoComments = trust.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const trustUsesTenantGrant = /canUserPerformTenantCapability/.test(trustNoComments) && !/requireRole/.test(trustNoComments);
    record('T18 bank-http+payout baselineados+intocados; trust FORA do baseline usando tenant grant (requireRole removido)',
      bankPayoutBaselined && trustOutOfBaseline && bankPayoutUntouched && trustUsesTenantGrant,
      `bankPayoutBaselined=${bankPayoutBaselined} trustOut=${trustOutOfBaseline} bankPayoutUntouched=${bankPayoutUntouched} trustTenant=${trustUsesTenantGrant}`);
  }
  // ── T19 — dispute/reversal contidos ──
  record('T19 dispute/reversal HTTP contido (DISPUTE_REVERSAL_HTTP_DISABLED)',
    readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8').includes('DISPUTE_REVERSAL_HTTP_DISABLED'));
  // ── T20 — POST /service-orders contido ──
  record('T20 POST /service-orders contido (SERVICE_ORDER_DIRECT_CREATE_DISABLED)',
    readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8').includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED'));
  // ── T21 — Bank intocado ──
  record('T21 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ R2: tenant-wide abre SÓ por tenant_operator_grants; company_users nunca abre tenant-wide; grant tenant A≠B; actor-scoped continua company-scoped; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
