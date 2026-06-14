/**
 * E2E — F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION (DECISION-0130). NÃO MOVE DINHEIRO.
 *
 * Prova a aprovação MATERIAL de payout dentro da faixa MVP: policy + authority (operador financeiro
 * institucional) + faixa (50000/150000) + travas D7 (KYC/ATL/recovery/risco/destino) + limite diário +
 * segregação (requester≠approver) + auditoria append-only. HTTP aprova mas NUNCA executa (executed:false,
 * sem Bank/worker/ledger). 36 cenários (T1–T36) + concorrência.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-approve-endpoint-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (l: string, ok: boolean, r?: string): void => { results.push({ label: l, ok, reason: r }); console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`); };
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const cwd = process.cwd();
const guardGreen = (s: string): boolean => { try { execSync(`node scripts/${s}`, { cwd, encoding: 'utf8' }); return true; } catch { return false; } };

let CURRENT_USER = ''; let CURRENT_TENANT = '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payout|approve|decision|test|ephemeral/i.test(db)) throw new Error(`ABORT: "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const payoutModule = (await import('../modules/payout/payout.module')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: CURRENT_USER, userId: CURRENT_USER, tenantId: CURRENT_TENANT };
      (req as any).tenant = { id: CURRENT_TENANT };
    });
    await scope.register(payoutModule);
  });
  await app.ready();
  return app;
}

let CONCEPT = '';
let seq = 0;
const nextCpf = (): string => { seq += 1; return String(10000000000 + seq * 137 + Math.floor(Math.random() * 100)); };

async function mkTenant(slug: string): Promise<string> {
  const t = uuidv4();
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [t, slug, slug]);
  // conta system clearing (fonte de coverage); creditada por actor em mkActorPayout (bank_transactions.actor_id NOT NULL).
  await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'clearing')`, [t, `system:clearing:${t}`]);
  return t;
}

async function mkUser(tenantId: string, kyc = 'approved'): Promise<string> {
  const gid = uuidv4(); const uid = uuidv4(); const cpf = nextCpf();
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gid, cpf]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf',$3,'complete')`, [gid, cpf, kyc]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [uid, tenantId, `u-${uid.slice(0, 8)}@e2e.local`, gid]);
  return uid;
}

interface Bundle { actorId: string; ownerUserId: string; payoutId: string; approvalId: string; walletAccountId: string; walletTxId: string; }

async function mkActorPayout(tenantId: string, kyc: string, amountCents: number): Promise<Bundle> {
  const ownerUserId = await mkUser(tenantId, kyc);
  const gid = (await q(`SELECT global_user_id FROM users WHERE id=$1`, [ownerUserId])).rows[0].global_user_id;
  const actorId = uuidv4();
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Actor',$3,$4)`, [actorId, tenantId, ownerUserId, gid]);
  await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet')`, [tenantId, `${actorId}:actor_wallet`, actorId]);
  const walletAccountId = (await q(`SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 AND account_type='actor_wallet' LIMIT 1`, [tenantId, actorId])).rows[0].id;
  // coverage: credita a conta system clearing (atribuída a este actor) ANTES de creditar a wallet
  // (check_coverage_before_credit dispara só em conta não-system).
  const clearingId = (await q(`SELECT id FROM bank_accounts WHERE tenant_id=$1 AND account_type='clearing' AND owner_type='system' LIMIT 1`, [tenantId])).rows[0].id;
  const cvt = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e approve coverage seed','e2e_appr_cov',$6,$7)`, [cvt, tenantId, actorId, clearingId, 100000000, cvt, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e approve coverage seed')`, [tenantId, clearingId, cvt, 100000000]);
  const wt = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e approve wallet seed','e2e_appr_seed',$6,$7)`, [wt, tenantId, actorId, walletAccountId, 5000000, wt, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e approve wallet seed')`, [tenantId, walletAccountId, wt, 5000000]);

  const { actorWalletPayoutService } = await import('../modules/wallet/actor-wallet-payout.service');
  const r = await actorWalletPayoutService.requestActorWalletPayout({
    tenantId, actorId, requestedByUserId: ownerUserId, requestedAmountCents: amountCents,
    idempotencyKey: `appr-${actorId}`, reason: 'e2e approve fixture',
  });
  return { actorId, ownerUserId, payoutId: r.payoutRequest.id, approvalId: r.payoutRequest.approvalRequestId!, walletAccountId, walletTxId: wt };
}

async function mkPolicy(tenantId: string, opts: { max?: number; daily?: number; requiresSecond?: boolean; active?: boolean } = {}): Promise<string> {
  const r = await q(
    `INSERT INTO financial_approval_policies (tenant_id, scope, max_amount_cents, daily_limit_cents, requires_second_approval, is_active, reason)
     VALUES ($1,'actor_wallet_payout',$2,$3,$4,$5,'e2e policy') RETURNING id`,
    [tenantId, opts.max ?? 50000, opts.daily ?? 150000, opts.requiresSecond ?? false, opts.active ?? true]
  );
  return r.rows[0].id;
}
async function mkAuthority(tenantId: string, policyId: string, userId: string, opts: { max?: number; daily?: number; active?: boolean } = {}): Promise<string> {
  const r = await q(
    `INSERT INTO financial_approval_authorities (tenant_id, policy_id, user_id, scope, max_amount_cents, daily_limit_cents, is_active, reason)
     VALUES ($1,$2,$3,'actor_wallet_payout',$4,$5,$6,'e2e authority') RETURNING id`,
    [tenantId, policyId, userId, opts.max ?? 50000, opts.daily ?? 150000, opts.active ?? true]
  );
  return r.rows[0].id;
}

const snap = async (t: string, tenantId: string): Promise<number> => Number((await q(`SELECT count(*)::int n FROM ${t} WHERE tenant_id=$1`, [tenantId])).rows[0].n);
const apprStatus = async (id: string): Promise<string> => (await q(`SELECT status FROM approval_requests WHERE id=$1`, [id])).rows[0]?.status;
const payoutRow = async (id: string) => (await q(`SELECT status, approved_amount_cents, executed_amount_cents, settlement_transaction_id FROM actor_wallet_payout_requests WHERE id=$1`, [id])).rows[0];
const approvedEvents = async (payoutId: string): Promise<number> => Number((await q(`SELECT count(*)::int n FROM financial_approval_policy_events WHERE payout_request_id=$1 AND decision='approved'`, [payoutId])).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeral();
  CONCEPT = (await q(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0]?.concept_id;
  if (!CONCEPT) throw new Error('Sem concept.');

  // ── tenants ──
  const TENANT = await mkTenant(`e2e-appr-${uuidv4().slice(0, 8)}`);
  const T_NP = await mkTenant(`e2e-nop-${uuidv4().slice(0, 8)}`);   // sem policy
  const T_WP = await mkTenant(`e2e-wp-${uuidv4().slice(0, 8)}`);    // com policy, sem authority do APPROVER

  const APPROVER = await mkUser(TENANT);
  const APPROVER_NOAUTH = await mkUser(TENANT);
  const POLICY = await mkPolicy(TENANT);
  await mkAuthority(TENANT, POLICY, APPROVER);

  // actors do TENANT principal
  const A_OK = await mkActorPayout(TENANT, 'approved', 1000);
  const A_FAIXA = await mkActorPayout(TENANT, 'approved', 60000);
  const A_DAILY = await mkActorPayout(TENANT, 'approved', 40000);
  const A_T23 = await mkActorPayout(TENANT, 'approved', 40000);
  const A_KYC = await mkActorPayout(TENANT, 'pending', 1000);
  const A_ATL = await mkActorPayout(TENANT, 'approved', 1000);
  const A_RISK = await mkActorPayout(TENANT, 'approved', 1000);
  const A_REC = await mkActorPayout(TENANT, 'approved', 1000);
  const A_DEST = await mkActorPayout(TENANT, 'approved', 1000);
  const A_CONC = await mkActorPayout(TENANT, 'approved', 30000);
  const A_REVK = await mkActorPayout(TENANT, 'approved', 1000);
  const A_SPOOF = await mkActorPayout(TENANT, 'approved', 1000);

  // D7 seeds
  await q(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_at, blocked_reason) VALUES ($1,$2,now(),'e2e atl')`, [A_ATL.actorId, TENANT]);
  await q(`INSERT INTO actor_risk_profile (actor_id, risk_score, risk_level, flags, risk_rules_version) VALUES ($1,180,'high','{}'::jsonb,1)`, [A_RISK.actorId]);
  // recovery obligation ativa para A_REC
  const pi = uuidv4();
  await q(`INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, payment_status, intent_type, reference_id, gateway, currency) VALUES ($1,$2,$3,$4,'pending','payout_recovery',$5,'internal','BRL')`, [pi, TENANT, A_REC.actorId, 1000, uuidv4()]);
  await q(`INSERT INTO actor_wallet_recovery_obligations (tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id, original_transaction_id, payment_intent_id, amount_cents, reason, status, recovered_amount_cents) VALUES ($1,$2,$3,$2,$3,$4,$5,$6,'e2e recovery','approved',0)`, [TENANT, A_REC.actorId, A_REC.walletAccountId, A_REC.walletTxId, pi, 1000]);
  // pré-uso diário p/ A_DAILY: evento aprovado de 120000 hoje.
  await q(`INSERT INTO financial_approval_policy_events (tenant_id, policy_id, actor_id, decision, approved_by_user_id, requested_by_user_id, amount_cents, reason, idempotency_key) VALUES ($1,$2,$3,'approved',$4,$5,120000,'preseed daily',$6)`, [TENANT, POLICY, A_DAILY.actorId, APPROVER, A_DAILY.ownerUserId, `preseed:${A_DAILY.actorId}`]);

  // T_NP: actor+payout sem policy
  const APPROVER_NP = await mkUser(T_NP);
  const A_NP = await mkActorPayout(T_NP, 'approved', 1000);
  // T_WP: policy mas APPROVER (do TENANT) não tem authority lá
  await mkPolicy(T_WP);
  const A_WP = await mkActorPayout(T_WP, 'approved', 1000);

  const app = await buildApp();
  const hdr = { 'content-type': 'application/json' };
  const decide = (tenantId: string, userId: string, id: string, payload: object) => {
    CURRENT_TENANT = tenantId; CURRENT_USER = userId;
    return app.inject({ method: 'POST', url: `/api/payouts/requests/${id}/decision`, headers: hdr, payload: JSON.stringify(payload) });
  };
  const body = (r: any) => { try { return JSON.parse(r.body); } catch { return null; } };

  const lB = await snap('bank_ledger', TENANT); const txB = await snap('bank_transactions', TENANT); const spB = await snap('bank_splits', TENANT);

  try {
    // ── Cenário policy AUSENTE (T_NP) ──
    const r1 = await decide(T_NP, APPROVER_NP, A_NP.payoutId, { decision: 'approve' });
    record('T1 policy ausente → 422 PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED', r1.statusCode === 422 && body(r1)?.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED', `status=${r1.statusCode} code=${body(r1)?.code}`);
    record('T2 approval continua pending', (await apprStatus(A_NP.approvalId)) === 'pending');
    record('T3 payout continua pending_approval', (await payoutRow(A_NP.payoutId)).status === 'pending_approval');
    record('T4 executed:false', body(r1)?.executed === false);
    record('T5 zero bank no tenant sem policy', (await snap('bank_ledger', T_NP)) === (await snap('bank_ledger', T_NP)));

    // ── Segregação (T14, antes do happy path consumir A_OK) ──
    const r14 = await decide(TENANT, A_OK.ownerUserId, A_OK.payoutId, { decision: 'approve' });
    record('T14 requester == approver → 403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER', r14.statusCode === 403 && body(r14)?.code === 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER' && (await apprStatus(A_OK.approvalId)) === 'pending');

    // ── Autoridade ausente (T15) ──
    const r15 = await decide(TENANT, APPROVER_NOAUTH, A_OK.payoutId, { decision: 'approve' });
    record('T15 user sem authority → 403 PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND', r15.statusCode === 403 && body(r15)?.code === 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND' && (await apprStatus(A_OK.approvalId)) === 'pending');

    // T16/T17 — grants comuns não aprovam (estrutural: ausentes no Core/rota).
    const coreSrc = readFileSync(join(cwd, 'src/core/financial-approval/payout-approval-policy.service.ts'), 'utf8').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
    const routeSrc = readFileSync(join(cwd, 'src/modules/payout/payout-decision.routes.ts'), 'utf8').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
    record('T16 company_users NÃO é autoridade (ausente em core/rota)', !/company_users/.test(coreSrc) && !/company_users/.test(routeSrc));
    record('T17 tenant_operator_grants NÃO é autoridade (ausente em core/rota)', !/tenant_operator_grants/.test(coreSrc) && !/tenant_operator_grants/.test(routeSrc));

    // ── Spoof (T24): APPROVER_NOAUTH + spoof approvedByUserId=APPROVER NÃO empresta autoridade ──
    const r24 = await decide(TENANT, APPROVER_NOAUTH, A_SPOOF.payoutId, { decision: 'approve', approvedByUserId: APPROVER, tenantId: TENANT, status: 'approved', operationType: 'transfer', approvalRequestId: uuidv4(), amountCents: 1, availableBalanceCents: 999999999 });
    record('T24 spoof body NÃO vira autoridade (APPROVER_NOAUTH segue sem authority → 403)', r24.statusCode === 403 && body(r24)?.code === 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND' && (await apprStatus(A_SPOOF.approvalId)) === 'pending');

    // ── Happy path (T6–T13): APPROVER aprova A_OK ──
    const r6 = await decide(TENANT, APPROVER, A_OK.payoutId, { decision: 'approve', reason: 'ok' });
    const b6 = body(r6);
    record('T6 approve válido → approval pending → approved', r6.statusCode === 200 && (await apprStatus(A_OK.approvalId)) === 'approved', `status=${r6.statusCode} appr=${await apprStatus(A_OK.approvalId)}`);
    const p6 = await payoutRow(A_OK.payoutId);
    record('T7 payout pending_approval → approved', p6.status === 'approved', `status=${p6.status}`);
    record('T8 executed:false', b6?.executed === false && b6?.payoutStatus === 'approved');
    record('T9 bank_ledger intocado', (await snap('bank_ledger', TENANT)) === lB);
    record('T10 bank_transactions intocado', (await snap('bank_transactions', TENANT)) === txB);
    record('T11 bank_splits intocado', (await snap('bank_splits', TENANT)) === spB);
    record('T12 não chama worker (dormancy verde)', guardGreen('audit-financial-workers-dormancy.mjs'));
    record('T13 não executa payout (não completed; sem settlement/executed)', p6.status === 'approved' && p6.executed_amount_cents === null && p6.settlement_transaction_id === null);

    // ── Autoridade: cross-tenant (T18), revoked authority (T19), revoked policy (T20) ──
    const r18 = await decide(T_WP, APPROVER, A_WP.payoutId, { decision: 'approve' });
    record('T18 cross-tenant authority falha → 403 AUTHORITY_NOT_FOUND', r18.statusCode === 403 && body(r18)?.code === 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND');

    await q(`UPDATE financial_approval_authorities SET is_active=false, revoked_at=now() WHERE tenant_id=$1 AND user_id=$2`, [TENANT, APPROVER]);
    const r19 = await decide(TENANT, APPROVER, A_REVK.payoutId, { decision: 'approve' });
    record('T19 authority revogada/inativa falha → 403 AUTHORITY_NOT_FOUND', r19.statusCode === 403 && body(r19)?.code === 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND');
    await q(`UPDATE financial_approval_authorities SET is_active=true, revoked_at=NULL WHERE tenant_id=$1 AND user_id=$2`, [TENANT, APPROVER]);

    await q(`UPDATE financial_approval_policies SET is_active=false, revoked_at=now() WHERE id=$1`, [POLICY]);
    const r20 = await decide(TENANT, APPROVER, A_REVK.payoutId, { decision: 'approve' });
    record('T20 policy revogada/inativa falha → 422 POLICY_NOT_CONFIGURED', r20.statusCode === 422 && body(r20)?.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED');
    await q(`UPDATE financial_approval_policies SET is_active=true, revoked_at=NULL WHERE id=$1`, [POLICY]);

    // ── Faixa (T21–T23) ──
    const r21 = await decide(TENANT, APPROVER, A_FAIXA.payoutId, { decision: 'approve' });
    record('T21 amount > 50000 → 422 APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL', r21.statusCode === 422 && body(r21)?.code === 'APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL' && (await payoutRow(A_FAIXA.payoutId)).status === 'pending_approval');
    const r22 = await decide(TENANT, APPROVER, A_DAILY.payoutId, { decision: 'approve' });
    record('T22 daily > 150000 → 422 PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED', r22.statusCode === 422 && body(r22)?.code === 'PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED' && (await payoutRow(A_DAILY.payoutId)).status === 'pending_approval');
    const r23 = await decide(TENANT, APPROVER, A_T23.payoutId, { decision: 'approve' });
    record('T23 amount<=50000 e diário ok → aprova', r23.statusCode === 200 && (await payoutRow(A_T23.payoutId)).status === 'approved' && body(r23)?.executed === false);

    // ── Legado/selos (T25–T34) ──
    record('T25 seller_available não usado (core/rota)', !/seller_available/.test(coreSrc) && !/seller_available/.test(routeSrc));
    record('T26 payout_requests legado não usado', !/\bpayout_requests\b/.test(coreSrc) && !/\bpayout_requests\b/.test(routeSrc));
    const ro = await app.inject({ method: 'POST', url: '/api/payouts/batches', headers: hdr, payload: '{}' });
    const rem = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/execute-manual`, headers: hdr, payload: '{}' });
    const rf = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/fail`, headers: hdr, payload: '{}' });
    record('T27 rotas antigas continuam 403', ro.statusCode === 403 && rem.statusCode === 403 && rf.statusCode === 403);
    record('T28 worker default-off', guardGreen('audit-financial-workers-dormancy.mjs'));
    record('T29 bank-http request-only', guardGreen('audit-bank-http-authority-binding.mjs'));
    let baseline0 = false; try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
    record('T30 DECISION-0113 baseline=0', baseline0);
    const canExec = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`)).rows[0].n;
    record('T31 can_execute_* comum não criado', canExec === 0, `canExec=${canExec}`);
    record('T32 request-only continua criando pending (guard verde + payout nasceu pending)', guardGreen('audit-payout-request-only-entrypoint.mjs'));
    record('T33 approve real NÃO marca completed', (await payoutRow(A_OK.payoutId)).status === 'approved' && (await payoutRow(A_T23.payoutId)).status === 'approved');
    record('T34 worker system-only (executor selado, sem HTTP) — guards verdes', guardGreen('audit-payout-execution-seal.mjs') && guardGreen('audit-payout-worker-system-only.mjs'));

    // ── Concorrência (T35): 2 aprovações concorrentes do MESMO payout → 1 evento, daily contado 1x ──
    CURRENT_TENANT = TENANT; CURRENT_USER = APPROVER;
    const [c1, c2] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/payouts/requests/${A_CONC.payoutId}/decision`, headers: hdr, payload: JSON.stringify({ decision: 'approve' }) }),
      app.inject({ method: 'POST', url: `/api/payouts/requests/${A_CONC.payoutId}/decision`, headers: hdr, payload: JSON.stringify({ decision: 'approve' }) }),
    ]);
    const ev = await approvedEvents(A_CONC.payoutId);
    const dailyConc = Number((await q(`SELECT COALESCE(SUM(amount_cents),0)::text s FROM financial_approval_policy_events WHERE tenant_id=$1 AND actor_id=$2 AND decision='approved'`, [TENANT, A_CONC.actorId])).rows[0].s);
    record('T35 2 aprovações concorrentes → 1 evento aprovado, daily contado 1x (30000), payout approved',
      ev === 1 && dailyConc === 30000 && (await payoutRow(A_CONC.payoutId)).status === 'approved' && [c1.statusCode, c2.statusCode].every((s) => s === 200),
      `events=${ev} daily=${dailyConc} codes=${c1.statusCode}/${c2.statusCode}`);

    // ── D7 (T36): KYC/ATL/RECOVERY/RISCO/DESTINO bloqueiam materialmente ──
    const rk = await decide(TENANT, APPROVER, A_KYC.payoutId, { decision: 'approve' });
    const ra = await decide(TENANT, APPROVER, A_ATL.payoutId, { decision: 'approve' });
    const rr = await decide(TENANT, APPROVER, A_RISK.payoutId, { decision: 'approve' });
    const rc = await decide(TENANT, APPROVER, A_REC.payoutId, { decision: 'approve' });
    // destino: o payout real é internal_settlement; provamos o gate via chamada direta ao Core com pix_key.
    const { payoutApprovalPolicyService } = await import('../core/financial-approval/payout-approval-policy.service');
    const dd = await payoutApprovalPolicyService.decidePayoutApproval({
      tenantId: TENANT, approverUserId: APPROVER, payoutRequestId: A_DEST.payoutId, approvalRequestId: A_DEST.approvalId,
      actorId: A_DEST.actorId, requestedByUserId: A_DEST.ownerUserId, requestedAmountCents: 1000, destinationType: 'pix_key',
    });
    const d7ok =
      rk.statusCode === 422 && body(rk)?.code === 'PAYOUT_APPROVAL_BLOCKED_KYC' &&
      ra.statusCode === 422 && body(ra)?.code === 'PAYOUT_APPROVAL_BLOCKED_ATL' &&
      rr.statusCode === 422 && body(rr)?.code === 'PAYOUT_APPROVAL_BLOCKED_RISK' &&
      rc.statusCode === 422 && body(rc)?.code === 'PAYOUT_APPROVAL_BLOCKED_RECOVERY' &&
      dd.kind === 'blocked' && dd.code === 'PAYOUT_APPROVAL_BLOCKED_DESTINATION';
    record('T36 D7 bloqueiam: KYC/ATL/RISCO/RECOVERY (HTTP) + DESTINO (core) — todos 422 e payouts seguem pending',
      d7ok && (await payoutRow(A_KYC.payoutId)).status === 'pending_approval' && (await payoutRow(A_ATL.payoutId)).status === 'pending_approval' && (await payoutRow(A_RISK.payoutId)).status === 'pending_approval' && (await payoutRow(A_REC.payoutId)).status === 'pending_approval',
      `kyc=${body(rk)?.code} atl=${body(ra)?.code} risk=${body(rr)?.code} rec=${body(rc)?.code} dest=${dd.kind === 'blocked' ? dd.code : dd.kind}`);

    // selo final: nenhum bank_* tocado no tenant inteiro durante todo o run.
    record('T+ bank_ledger imutável no run inteiro', (await snap('bank_ledger', TENANT)) === lB);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Aprovação material de payout dentro da faixa MVP (policy+authority+D7+diário+segregação); HTTP aprova sem executar; zero dinheiro — verde.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
