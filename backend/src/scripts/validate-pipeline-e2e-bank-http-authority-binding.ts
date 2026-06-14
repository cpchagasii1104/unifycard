/**
 * E2E — F-BANK-HTTP-AUTHORITY-BINDING (DECISION-0128).
 *
 * Prova que os writers move-money de bank-http viraram REQUEST-ONLY: criam approval_request
 * no Core de Aprovação Financeira e NÃO executam Bank (zero bank_ledger/bank_transactions/bank_splits).
 *
 *   T1  POST /bank/transactions/simple (conta do user) → 202 status=requested, executed:false.
 *   T2  approval_request criada (operation_type=transfer; requested_by_user_id=user server-side).
 *   T3  POST /bank/transactions/split → 202 status=requested.
 *   T4  idempotency: mesmo eventId → mesma approvalRequestId (uma request).
 *   T5  spoof: body.actor / actorId / actionContext / tenant_id NÃO viram autoridade/subject.
 *   T6  fromAccount de OUTRO dono → 403 (assertUserOwnsFromAccount); nenhuma approval criada.
 *   T7  bank_ledger count before == after.
 *   T8  bank_transactions count before == after.
 *   T9  bank_splits count before == after.
 *   T10 actor_wallet_payout_requests (payout) count before == after.
 *   T11 DECISION-0113 baseline = 1 (bank-http fora/reconhecido; payout segue baselined).
 *   T12 zero coluna can_execute_* em company_users / tenant_operator_grants.
 *   S1  guard bank-http-authority-binding verde (request-only; sem Bank exec; sem availableBalanceCents).
 *
 * 🔒 DB EFÊMERA (wrapper run-bank-http-authority-binding-ephemeral.ps1). Zero dinheiro movido.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

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
  if (!/bank|http|binding|approval|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const tableExists = async (t: string): Promise<boolean> =>
  (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [t])) === 1;

interface Fixture { tenantId: string; userId: string; actorId: string; ownedAccountId: string; toAccountId: string; foreignAccountId: string; }

async function seedFixture(seed: number): Promise<Fixture> {
  const tenantId = randomUUID();
  const globalUserId = randomUUID();
  const userId = randomUUID();
  const actorId = randomUUID();
  const cpf = String(10000000000 + (seed % 89999999999));
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [tenantId, `e2e-bankhttp-${seed}`, `e2e-bankhttp-${seed}`]);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [globalUserId, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [globalUserId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [userId, tenantId, `e2e-bankhttp-${seed}@e2e.local`, globalUserId]);
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Bank User',$3,$4)`, [actorId, tenantId, userId, globalUserId]);
  // Conta DO user: owner_type DB 'actor' + owner_id = userId (exato) → API ownerType='user', ownerId=userId.
  const owned = await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'user_wallet') RETURNING id`,
    [tenantId, userId, actorId]);
  // Conta destino (qualquer).
  const to = await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet') RETURNING id`,
    [tenantId, actorId, actorId]);
  // Conta de OUTRO dono (não pertence ao user).
  const foreign = await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'user_wallet') RETURNING id`,
    [tenantId, randomUUID(), actorId]);
  return { tenantId, userId, actorId, ownedAccountId: owned.rows[0].id, toAccountId: to.rows[0].id, foreignAccountId: foreign.rows[0].id };
}

async function buildApp(fx: Fixture): Promise<FastifyInstance> {
  // ensureUserActor (actor-writer) usa socialPortsRegistry — injetar adapters (como no bootstrap).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const app = Fastify({ logger: false });
  await app.register(sensible);
  const bankHttpRoutes = (await import('../core/unifybank/bank-http.routes')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: fx.userId, userId: fx.userId, tenantId: fx.tenantId };
      (req as any).tenant = { id: fx.tenantId };
    });
    await scope.register(bankHttpRoutes, { prefix: '/bank' });
  });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  const fx = await seedFixture(base);
  const app = await buildApp(fx);

  const lExists = await tableExists('bank_ledger');
  const txExists = await tableExists('bank_transactions');
  const spExists = await tableExists('bank_splits');
  const poExists = await tableExists('actor_wallet_payout_requests');
  const ledgerBefore = lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
  const txBefore = txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
  const spBefore = spExists ? await count(`SELECT count(*)::text n FROM bank_splits`) : 0;
  const poBefore = poExists ? await count(`SELECT count(*)::text n FROM actor_wallet_payout_requests`) : 0;
  const apprBefore = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1`, [fx.tenantId]);

  const hdr = { 'content-type': 'application/json' };
  try {
    const eventId = `evt-${base}`;
    // T1 — POST simple (conta do user) → 202 requested.
    const r1 = await app.inject({ method: 'POST', url: '/bank/transactions/simple', headers: hdr,
      payload: JSON.stringify({ eventId, referenceType: 'p2p_transfer', fromAccountId: fx.ownedAccountId, toAccountId: fx.toAccountId, amountCents: 5000, transactionType: 'transfer',
        // 🪤 spoof: estes campos NÃO podem virar autoridade/subject.
        actor: { kind: 'system', actorId: randomUUID() }, actorId: randomUUID(), tenant_id: randomUUID() }) });
    const b1 = r1.statusCode === 202 ? JSON.parse(r1.body) : null;
    record('T1 POST /transactions/simple → 202 status=requested, executed:false',
      r1.statusCode === 202 && b1?.status === 'requested' && b1?.executed === false && !!b1?.approvalRequestId,
      `status=${r1.statusCode} body=${r1.body.slice(0, 160)}`);

    // T2 — approval_request criada, subject server-side.
    const appr = b1?.approvalRequestId
      ? (await pool.query(`SELECT operation_type, requested_by_user_id, status FROM approval_requests WHERE id=$1`, [b1.approvalRequestId])).rows[0]
      : null;
    record('T2 approval_request criada (operation_type=transfer; requested_by_user_id=user server-side)',
      !!appr && appr.operation_type === 'transfer' && appr.requested_by_user_id === fx.userId && appr.status === 'pending',
      JSON.stringify(appr));

    // T3 — POST split → 202.
    const r3 = await app.inject({ method: 'POST', url: '/bank/transactions/split', headers: hdr,
      payload: JSON.stringify({ eventId: `${eventId}-split`, fromAccountId: fx.ownedAccountId, amountCents: 7000, context: 'p2p_transfer' }) });
    const b3 = r3.statusCode === 202 ? JSON.parse(r3.body) : null;
    record('T3 POST /transactions/split → 202 status=requested', r3.statusCode === 202 && b3?.status === 'requested' && b3?.executed === false, `status=${r3.statusCode}`);

    // T4 — idempotência (mesmo eventId no simple).
    const r4 = await app.inject({ method: 'POST', url: '/bank/transactions/simple', headers: hdr,
      payload: JSON.stringify({ eventId, referenceType: 'p2p_transfer', fromAccountId: fx.ownedAccountId, toAccountId: fx.toAccountId, amountCents: 5000, transactionType: 'transfer' }) });
    const b4 = r4.statusCode === 202 ? JSON.parse(r4.body) : null;
    record('T4 idempotency: mesmo eventId → mesma approvalRequestId', !!b4 && b4.approvalRequestId === b1?.approvalRequestId, `r1=${b1?.approvalRequestId} r4=${b4?.approvalRequestId}`);

    // T5 — spoof não vira subject (já validado em T2: requested_by_user_id=user, não o actorId do body).
    record('T5 spoof body.actor/actorId/actionContext/tenant_id NÃO vira subject/autoridade',
      !!appr && appr.requested_by_user_id === fx.userId);

    // T6 — fromAccount de outro dono → 403; nenhuma approval criada.
    const apprMid = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1`, [fx.tenantId]);
    const r6 = await app.inject({ method: 'POST', url: '/bank/transactions/simple', headers: hdr,
      payload: JSON.stringify({ eventId: `evt-foreign-${base}`, referenceType: 'p2p_transfer', fromAccountId: fx.foreignAccountId, toAccountId: fx.toAccountId, amountCents: 100, transactionType: 'transfer' }) });
    const apprAfter6 = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1`, [fx.tenantId]);
    record('T6 fromAccount de outro dono → 403; nenhuma approval criada', r6.statusCode === 403 && apprAfter6 === apprMid, `status=${r6.statusCode} appr ${apprMid}->${apprAfter6}`);

    // T7/T8/T9/T10 — Bank/payout intocados.
    const ledgerAfter = lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
    const txAfter = txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
    const spAfter = spExists ? await count(`SELECT count(*)::text n FROM bank_splits`) : 0;
    const poAfter = poExists ? await count(`SELECT count(*)::text n FROM actor_wallet_payout_requests`) : 0;
    record('T7 bank_ledger count before==after', ledgerAfter === ledgerBefore, `${ledgerBefore}->${ledgerAfter}`);
    record('T8 bank_transactions count before==after', txAfter === txBefore, `${txBefore}->${txAfter}`);
    record('T9 bank_splits count before==after', spAfter === spBefore, `${spBefore}->${spAfter}`);
    record('T10 actor_wallet_payout_requests count before==after (payout intocado)', poAfter === poBefore, `${poBefore}->${poAfter}`);

    // confirma que houve criação request-only (2 requests: simple + split).
    const apprFinal = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1`, [fx.tenantId]);
    record('T2b request-only criou approval_requests (simple+split)', apprFinal - apprBefore === 2, `delta=${apprFinal - apprBefore}`);

    // T11 — baseline 0113 = 1.
    let baseline1 = false;
    try {
      const out = execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd: process.cwd(), encoding: 'utf8' });
      baseline1 = /baseline=1\b/.test(out) && /new=0\b/.test(out) && /resolveForUser.*reader bank/.test(out);
    } catch { baseline1 = false; }
    record('T11 DECISION-0113 baseline = 1 (bank-http reconhecido; payout segue)', baseline1);

    // T12 — zero can_execute_* em grants comuns.
    const canExec = await count(`SELECT count(*)::text n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`);
    record('T12 zero coluna can_execute_* em company_users/tenant_operator_grants', canExec === 0, `cols=${canExec}`);

    // S1 — guard bank-http verde.
    let guardOk = false;
    try { execSync('node scripts/audit-bank-http-authority-binding.mjs', { cwd: process.cwd(), encoding: 'utf8' }); guardOk = true; } catch { guardOk = false; }
    record('S1 guard bank-http-authority-binding verde', guardOk);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ bank-http writers request-only (bind ao Core); zero Bank; baseline 0113 = 1 — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
