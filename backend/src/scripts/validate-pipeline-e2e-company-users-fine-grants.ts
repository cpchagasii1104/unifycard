/**
 * E2E F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-company-users-fine-grants-ephemeral.ps1 (cria DB, migra, roda, dropa).
 *
 * Prova: a autoridade fina das superfícies admin reporting/business-audit/risk-dashboard/policy-engine
 * vem de `company_users.can_*` (fonte material do R2 mínimo) com SUBJECT server-side (req.user.id resolvido
 * para global_user_id via JOIN canônico), NÃO do chain legado (organization_members ausente ⇒ 403). O
 * actorId de query/params/actionContext é FILTRO/alvo, NUNCA subject. Bank/payout/dispute/service-orders
 * intocados; contenções anteriores intactas.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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

async function addMembership(tenantId: string, companyId: string, gu: string, grants: Record<string, boolean>, role = 'staff'): Promise<void> {
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, can_view_reports, can_view_audit_logs, can_view_risk, can_manage_risk, can_manage_policy, is_active, is_primary, member_status, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,true,false,'active','{}'::jsonb)`,
    [tenantId, companyId, gu, role,
      grants.can_manage_company === true,
      grants.can_view_reports === true,
      grants.can_view_audit_logs === true,
      grants.can_view_risk === true,
      grants.can_manage_risk === true,
      grants.can_manage_policy === true],
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── T0 — migration aplicada: 4 colunas can_* novas existem em company_users ──
  const cols = (await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='company_users' AND column_name = ANY($1)`,
    [['can_view_audit_logs', 'can_view_risk', 'can_manage_risk', 'can_manage_policy']],
  )).rows.map((r) => r.column_name).sort();
  record('T0 migration: company_users.{can_view_audit_logs,can_view_risk,can_manage_risk,can_manage_policy} existem (NOT NULL DEFAULT false)',
    cols.length === 4, `cols=${cols.join(',')}`);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'R2 Grants', slug: `r2g-${Date.now()}` });
  const companyId = (await pool.query<{ id: string }>(
    `INSERT INTO companies (tenant_id, company_name, status, company_status) VALUES ($1::uuid,'R2 Co','active','ACTIVE') RETURNING company_id::text AS id`,
    [TENANT_ID],
  )).rows[0].id;

  const none = await mkUser(TENANT_ID, 'NoGrant');      await addMembership(TENANT_ID, companyId, none.gu, {});
  const rep = await mkUser(TENANT_ID, 'Reporter');      await addMembership(TENANT_ID, companyId, rep.gu, { can_view_reports: true });
  const aud = await mkUser(TENANT_ID, 'Auditor');       await addMembership(TENANT_ID, companyId, aud.gu, { can_view_audit_logs: true });
  const rsk = await mkUser(TENANT_ID, 'RiskViewer');    await addMembership(TENANT_ID, companyId, rsk.gu, { can_view_risk: true });
  const pol = await mkUser(TENANT_ID, 'PolicyManager'); await addMembership(TENANT_ID, companyId, pol.gu, { can_manage_policy: true });
  const stranger = await mkUser(TENANT_ID, 'Stranger'); // SEM company_users — não-membro

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
  const post = (url: string, userId: string, body: any, actorId?: string) =>
    app.inject({ method: 'POST', url, headers: { 'x-test-user-id': userId, ...(actorId ? { 'x-test-actor-id': actorId } : {}) }, payload: body });

  // Régua de AUTORIDADE: o gate (preHandler) ou NEGA (401/403) ou CONCEDE (request alcança o handler).
  // Esta frente prova autoridade — NÃO a existência de tabelas de módulos latentes (business_audit_logs/
  // policy_rules/evidence_packs/payout_orders NÃO são criadas pelas migrations canônicas). Um 500 por
  // tabela ausente é DOWNSTREAM do gate e PROVA que a autorização foi concedida (senão teria sido 403).
  const passedGate = (s: number): boolean => s !== 401 && s !== 403;

  // ── T1 — sem can_view_reports → reporting cross-actor → 403 ──
  {
    const r = await get(`/reporting/financial-kpis?actorId=${rep.actorId}`, none.userId);
    record('T1 user SEM can_view_reports (declara actorId alheio) → reporting 403', r.statusCode === 403, `status=${r.statusCode}`);
  }
  // ── T2 — com can_view_reports → reporting PERMITIDO (gate concede; alcança handler) ──
  {
    const r = await get('/reporting/financial-kpis', rep.userId);
    record('T2 user com can_view_reports → reporting AUTORIZADO (gate concede, ≠401/403)', passedGate(r.statusCode), `status=${r.statusCode} body=${r.body?.slice(0, 120)}`);
  }
  // ── T3 — sem can_view_audit_logs → business-audit → 403 ──
  {
    const r = await get('/business-audit-logs', none.userId);
    record('T3 user SEM can_view_audit_logs → business-audit 403', r.statusCode === 403, `status=${r.statusCode}`);
  }
  // ── T4 — com can_view_audit_logs → audit logs permitido ──
  {
    const r = await get('/business-audit-logs', aud.userId);
    record('T4 user com can_view_audit_logs → business-audit AUTORIZADO (gate concede, ≠401/403)', passedGate(r.statusCode), `status=${r.statusCode} body=${r.body?.slice(0, 120)}`);
  }
  // ── T5 — sem can_view_risk → risk-dashboard → 403 ──
  {
    const r = await get('/risk/dashboard/overview', none.userId, rep.actorId);
    record('T5 user SEM can_view_risk → risk-dashboard 403', r.statusCode === 403, `status=${r.statusCode}`);
  }
  // ── T6 — com can_view_risk → risk-dashboard permitido ──
  {
    const r = await get('/risk/dashboard/overview', rsk.userId, rsk.actorId);
    record('T6 user com can_view_risk → risk-dashboard AUTORIZADO (gate concede, ≠401/403)', passedGate(r.statusCode), `status=${r.statusCode} body=${r.body?.slice(0, 120)}`);
  }
  // ── T7 — actorId target NUNCA vira subject: não-membro declarando actorId de quem-pode → 403 ──
  {
    const r1 = await get(`/reporting/financial-kpis?actorId=${rep.actorId}`, stranger.userId);
    const r2 = await get('/risk/dashboard/overview', stranger.userId, rsk.actorId);
    record('T7 actorId alvo não vira subject (não-membro declarando actorId autorizado) → 403 em reporting E risk', r1.statusCode === 403 && r2.statusCode === 403, `rep=${r1.statusCode} risk=${r2.statusCode}`);
  }
  // ── T8 — subject==target spoof continua hard-fail no guard (estrutural) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const hardCheck = /SUBJECT_EQUALS_TARGET\s*=\s*\/requirePermission/.test(guard);
    record('T8 guard mantém SUBJECT_EQUALS_TARGET hard-fail (anti-spoof) presente', hardCheck);
  }
  // ── T9 — policy-engine: read E mutation gateados por can_manage_policy ──
  {
    const readNone = await get('/policies', none.userId);
    const readOk = await get('/policies', pol.userId);
    const mutNone = await post('/policies', none.userId, { policyType: 'risk_threshold', name: 'x', rules: {} });
    record('T9 policy: read NEGADO sem grant (403) / read AUTORIZADO com can_manage_policy (≠401/403) / mutation POST sem grant NEGADA (403) — reads+mutations no MESMO gate',
      readNone.statusCode === 403 && passedGate(readOk.statusCode) && mutNone.statusCode === 403,
      `readNone=${readNone.statusCode} readOk=${readOk.statusCode} mutNone=${mutNone.statusCode}`);
  }
  await app.close();

  // ── T10 — bank-http/payout permanecem baseline/hard-stop e NÃO foram tocados (estrutural) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const pay = readFileSync(join(process.cwd(), 'src/modules/payout/payout.routes.ts'), 'utf-8');
    const bank = readFileSync(join(process.cwd(), 'src/core/unifybank/bank-http.routes.ts'), 'utf-8');
    const baselined = /bank-http\.routes\.ts/.test(guard) && /payout\.routes\.ts/.test(guard);
    const untouched = !/canUserPerformCompanyCapability/.test(pay) && !/canUserPerformCompanyCapability/.test(bank) && /'financial:execute_payout'/.test(pay);
    record('T10 bank-http+payout ainda baselineados no guard + sem nova primitive (hard-stop intocado)', baselined && untouched, `baselined=${baselined} untouched=${untouched}`);
  }
  // ── T11 — dispute/reversal continuam contidos (estrutural) ──
  {
    const disp = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    record('T11 dispute/reversal HTTP contido (DISPUTE_REVERSAL_HTTP_DISABLED)', disp.includes('DISPUTE_REVERSAL_HTTP_DISABLED'));
  }
  // ── T12 — POST /service-orders continua 403/contido (estrutural) ──
  {
    const so = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8');
    record('T12 POST /service-orders contido (SERVICE_ORDER_DIRECT_CREATE_DISABLED)', so.includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED'));
  }
  // ── T13 — event/public-profiles bindings anteriores intactos (estrutural) ──
  {
    const ev = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf-8');
    const pp = readFileSync(join(process.cwd(), 'src/modules/public-profiles/public-profile.routes.ts'), 'utf-8');
    record('T13 event(userRepresentsActor) + public-profiles(canRepresentActor) bindings intactos', /userRepresentsActor\(/.test(ev) && /canRepresentActor\(/.test(pp));
  }
  // ── T14 — Bank intocado (zero escrita) ──
  record('T14 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ R2 fine-grants: company_users.can_* autoriza reporting/audit/risk/policy; subject server-side; actorId=filtro; Bank/payout/dispute/service-orders intocados.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
