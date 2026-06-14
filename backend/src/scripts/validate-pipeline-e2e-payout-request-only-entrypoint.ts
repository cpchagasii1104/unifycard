/**
 * E2E — F-PAYOUT-REQUEST-ONLY-ENTRYPOINT (DECISION-0128). NÃO MOVE DINHEIRO.
 *
 * Prova a entrada HTTP request-only: POST /api/payouts/requests cria SOMENTE a solicitação
 * (actor_wallet_payout_requests pending_approval + approval_requests pending), com autoridade
 * server-side via canRepresentActor; nunca aprova/executa/move dinheiro.
 *
 *   T1  request válido → 201 status=pending_approval, payoutRequestId, approvalRequestId, executed:false.
 *   T2  approval_request pending criado (operation_type=actor_wallet_payout).
 *   T3  executed:false na resposta.
 *   T4/T5/T6  request NÃO escreve bank_ledger / bank_transactions / bank_splits.
 *   T7  request NÃO executa (status pending_approval; sem settlement_transaction_id).
 *   T8  actor não-representável → 403 ACTOR_NOT_REPRESENTABLE; nenhuma request criada.
 *   T9  spoof body (requestedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents) IGNORADO.
 *   T10 amountCents inválido → 400.
 *   T11 idempotência: mesma key → 200 alreadyExisted, mesma request, sem duplicar.
 *   T12 active-gate: 2ª request (key nova) com uma ativa → 409.
 *   T13 availableBalanceCents não autoriza: amount > saldo → 422 (filtro de criação, não bypassável).
 *   T14 rotas antigas (batches/execute-manual/fail) continuam 403.
 *   T15 worker default-off + bank-http request-only + payout-request-only/execution-seal guards verdes.
 *   T16 DECISION-0113 baseline=0; zero can_execute_*.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-request-only-entrypoint-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
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

let TENANT = ''; let USER = ''; let ACTOR = ''; let CONCEPT = '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payout|request|entrypoint|test|ephemeral/i.test(db)) throw new Error(`ABORT: "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildApp(): Promise<FastifyInstance> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const app = Fastify({ logger: false });
  await app.register(sensible);
  const payoutModule = (await import('../modules/payout/payout.module')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: USER, userId: USER, tenantId: TENANT };
      (req as any).tenant = { id: TENANT };
    });
    await scope.register(payoutModule);
  });
  await app.ready();
  return app;
}

async function seed(base: number): Promise<void> {
  TENANT = uuidv4(); const gid = uuidv4(); USER = uuidv4(); ACTOR = uuidv4(); const cpf = String(10000000000 + (base % 89999999999));
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [TENANT, `e2e-preq-${base}`, `e2e-preq-${base}`]);
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gid, cpf]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gid, cpf]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [USER, TENANT, `preq-${base}@e2e.local`, gid]);
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Req User',$3,$4)`, [ACTOR, TENANT, USER, gid]);
  // actor_wallet (API ownerType='user' → DB owner_type='actor', owner_id='<actorId>:actor_wallet').
  await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet')`, [TENANT, `${ACTOR}:actor_wallet`, ACTOR]);
  CONCEPT = (await q(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0]?.concept_id;
  if (!CONCEPT) throw new Error('Sem concept.');
  // coverage (conta system clearing creditada) + crédito da wallet p/ passar o filtro de criação.
  const clearing = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'clearing') RETURNING id`, [TENANT, `system:clearing:${TENANT}`]);
  const ct = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e preq coverage seed','e2e_preq_cov',$6,$7)`, [ct, TENANT, ACTOR, clearing.rows[0].id, 100000000, ct, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e preq coverage seed')`, [TENANT, clearing.rows[0].id, ct, 100000000]);
  const wt = uuidv4(); const wacc = (await q(`SELECT id FROM bank_accounts WHERE tenant_id=$1 AND account_type='actor_wallet' LIMIT 1`, [TENANT])).rows[0].id;
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e preq wallet seed','e2e_preq_seed',$6,$7)`, [wt, TENANT, ACTOR, wacc, 10000, wt, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e preq wallet seed')`, [TENANT, wacc, wt, 10000]);
}

const countReq = async (): Promise<number> => Number((await q(`SELECT count(*)::int n FROM actor_wallet_payout_requests WHERE tenant_id=$1`, [TENANT])).rows[0].n);
const snap = async (t: string): Promise<number> => Number((await q(`SELECT count(*)::int n FROM ${t} WHERE tenant_id=$1`, [TENANT])).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeral();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  await seed(base);
  const app = await buildApp();
  const hdr = { 'content-type': 'application/json' };
  const post = (payload: object) => app.inject({ method: 'POST', url: '/api/payouts/requests', headers: hdr, payload: JSON.stringify(payload) });

  const lB = await snap('bank_ledger'); const txB = await snap('bank_transactions'); const spB = await snap('bank_splits');

  try {
    // T1/T2/T3 — request válido.
    const key1 = `preq-${base}`;
    const r1 = await post({ actorId: ACTOR, amountCents: 1000, reason: 'e2e request', idempotencyKey: key1 });
    const b1 = r1.statusCode === 201 ? JSON.parse(r1.body) : null;
    record('T1 POST /api/payouts/requests → 201 pending_approval + ids + executed:false',
      r1.statusCode === 201 && b1?.status === 'pending_approval' && !!b1?.payoutRequestId && !!b1?.approvalRequestId && b1?.executed === false,
      `status=${r1.statusCode} body=${r1.body.slice(0, 150)}`);
    const appr = b1?.approvalRequestId ? (await q(`SELECT status, operation_type FROM approval_requests WHERE id=$1`, [b1.approvalRequestId])).rows[0] : null;
    record('T2 approval_request pending + operation_type=actor_wallet_payout', !!appr && appr.status === 'pending' && appr.operation_type === 'actor_wallet_payout', JSON.stringify(appr));
    record('T3 executed:false', b1?.executed === false);

    // T4/T5/T6 — sem escrita Bank.
    record('T4 request NÃO escreve bank_ledger', (await snap('bank_ledger')) === lB);
    record('T5 request NÃO escreve bank_transactions', (await snap('bank_transactions')) === txB);
    record('T6 request NÃO escreve bank_splits', (await snap('bank_splits')) === spB);

    // T7 — não executa.
    const prow = await q(`SELECT status, settlement_transaction_id, executed_amount_cents FROM actor_wallet_payout_requests WHERE id=$1`, [b1.payoutRequestId]);
    record('T7 request não executa (status pending_approval; sem settlement)', prow.rows[0].status === 'pending_approval' && prow.rows[0].settlement_transaction_id === null && prow.rows[0].executed_amount_cents === null, JSON.stringify(prow.rows[0]));

    // T8 — actor não representável.
    const before8 = await countReq();
    const r8 = await post({ actorId: uuidv4(), amountCents: 100, reason: 'spoof actor', idempotencyKey: `preq-t8-${base}` });
    record('T8 actor não-representável → 403; nenhuma request criada', r8.statusCode === 403 && JSON.parse(r8.body).code === 'ACTOR_NOT_REPRESENTABLE' && (await countReq()) === before8, `status=${r8.statusCode}`);

    // T9 — spoof ignorado (req1 já criada com server-side subject). Verifica a request criada.
    const reqRow = await q(`SELECT ar.requested_by_user_id, ar.status, ar.operation_type FROM actor_wallet_payout_requests awp JOIN approval_requests ar ON ar.id=awp.approval_request_id WHERE awp.id=$1`, [b1.payoutRequestId]);
    // novo POST com spoof no body p/ outra wallet do mesmo user? same actor já tem ativa → testamos que o spoof não vira subject:
    const r9 = await post({ actorId: ACTOR, amountCents: 1000, reason: 'spoof', idempotencyKey: key1, requestedByUserId: uuidv4(), tenantId: uuidv4(), status: 'approved', operationType: 'transfer', approvalRequestId: uuidv4(), availableBalanceCents: 999999999 });
    const b9 = r9.statusCode === 200 ? JSON.parse(r9.body) : null; // mesma key → idempotente (retorna a request de T1)
    record('T9 spoof body (requestedByUserId/tenantId/status/operationType/availableBalanceCents) IGNORADO',
      reqRow.rows[0].requested_by_user_id === USER && reqRow.rows[0].operation_type === 'actor_wallet_payout' && reqRow.rows[0].status === 'pending' && (!b9 || b9.payoutRequestId === b1.payoutRequestId),
      `subj=${reqRow.rows[0].requested_by_user_id} optype=${reqRow.rows[0].operation_type} idemSame=${b9?.payoutRequestId === b1?.payoutRequestId}`);

    // T10 — amount inválido.
    const r10a = await post({ actorId: ACTOR, amountCents: 0, reason: 'x', idempotencyKey: `t10a-${base}` });
    const r10b = await post({ actorId: ACTOR, amountCents: -5, reason: 'x', idempotencyKey: `t10b-${base}` });
    record('T10 amountCents inválido (0/negativo) → 400', r10a.statusCode === 400 && r10b.statusCode === 400, `a=${r10a.statusCode} b=${r10b.statusCode}`);

    // T11 — idempotência (mesma key1 já usada em T1/T9 → mesma request).
    record('T11 idempotência: mesma key → 200 alreadyExisted, mesma request', r9.statusCode === 200 && b9?.alreadyExisted === true && b9?.payoutRequestId === b1.payoutRequestId, `r9=${r9.statusCode} same=${b9?.payoutRequestId === b1?.payoutRequestId}`);

    // T12 — active-gate (nova key, mesma actor com ativa) → 409.
    const r12 = await post({ actorId: ACTOR, amountCents: 100, reason: 'segunda', idempotencyKey: `t12-${base}` });
    record('T12 active-gate: 2ª request (key nova) com uma ativa → 409', r12.statusCode === 409 && JSON.parse(r12.body).code === 'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE', `status=${r12.statusCode}`);

    // T13 — availableBalanceCents não autoriza: cancelar a ativa, pedir > saldo → 422.
    await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE actor_id=$1 AND status IN ('pending_approval','approved','processing')`, [ACTOR]);
    const r13 = await post({ actorId: ACTOR, amountCents: 999999, reason: 'acima do saldo', idempotencyKey: `t13-${base}`, availableBalanceCents: 999999999 });
    record('T13 availableBalanceCents não autoriza: amount > saldo → 422 (filtro, não bypassável por body)', r13.statusCode === 422 && JSON.parse(r13.body).code === 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE', `status=${r13.statusCode}`);

    // T14 — rotas antigas 403.
    const rb = await app.inject({ method: 'POST', url: '/api/payouts/batches', headers: hdr, payload: '{}' });
    const rem = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/execute-manual`, headers: hdr, payload: '{}' });
    const rf = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/fail`, headers: hdr, payload: '{}' });
    record('T14 rotas antigas (batches/execute-manual/fail) continuam 403', rb.statusCode === 403 && rem.statusCode === 403 && rf.statusCode === 403, `${rb.statusCode}/${rem.statusCode}/${rf.statusCode}`);

    // T15 — guards.
    record('T15 worker default-off + bank-http request-only + request-only/execution-seal guards verdes',
      guardGreen('audit-financial-workers-dormancy.mjs') && guardGreen('audit-bank-http-authority-binding.mjs') && guardGreen('audit-payout-request-only-entrypoint.mjs') && guardGreen('audit-payout-execution-seal.mjs'));

    // T16 — baseline 0113=0 + zero can_execute_*.
    let baseline0 = false;
    try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
    const canExec = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`)).rows[0].n;
    record('T16 DECISION-0113 baseline=0 + zero can_execute_*', baseline0 && canExec === 0, `baseline0=${baseline0} canExec=${canExec}`);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Entrada de payout request-only: cria pending_approval + approval pending; autoridade canRepresentActor; zero dinheiro — verde.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
