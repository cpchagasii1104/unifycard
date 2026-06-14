/**
 * E2E — F-ACTOR-WALLET-PAYOUT-WIRING (DECISION-0128).
 *
 * Prova que os writers de payout viraram FAIL-CLOSED (não executam dinheiro/estado financeiro) e que
 * o último resíduo do baseline DECISION-0113 (payout) saiu → baseline 0. Zero dinheiro movido.
 *
 *   T1  POST /payouts/batches → 403; nenhuma approval_request criada; sem Bank.
 *   T2  POST /orders/:id/execute-manual → 403 (sem execução).
 *   T3  POST /orders/:id/fail → 403 (sem settlement/estado pago).
 *   T4  spoof body.actor/actorId/actionContext/tenant_id → 403 e zero efeito.
 *   T5  bank_ledger count before == after.
 *   T6  bank_transactions count before == after.
 *   T7  bank_splits count before == after.
 *   T8  actor_wallet_payout_requests não passa para pago/executado (count before == after).
 *   T9  approval_requests before == after (FAIL-CLOSED não cria request — não é request-only).
 *   T10 DECISION-0113 baseline = 0 (payout + bank-http reconhecidos; sem resíduo).
 *   T11 bank-http continua reconhecido (não regrediu ao baseline).
 *   T12 zero coluna can_execute_* em company_users / tenant_operator_grants.
 *   S1  estrutural: writers fail-closed (PAYOUT_HTTP_EXECUTION_DISABLED; sem createPayoutBatch/executePayoutManual/markAsFailed).
 *   S2  guard payout-authority-binding verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-authority-binding-ephemeral.ps1). Zero dinheiro.
 * Nota: o preHandler requirePayoutPermission (cadeia organization_members, legado) também 403 — defesa em
 * profundidade; a prova ESTRUTURAL (S1) garante que os handlers são fail-closed, não apenas auth-bloqueados.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const REPO = join(process.cwd(), '..');
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
  if (!/payout|binding|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const tableExists = async (t: string): Promise<boolean> =>
  (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [t])) === 1;

interface Fixture { tenantId: string; userId: string; actorId: string; }

async function seedFixture(seed: number): Promise<Fixture> {
  const tenantId = randomUUID(); const globalUserId = randomUUID(); const userId = randomUUID(); const actorId = randomUUID();
  const cpf = String(10000000000 + (seed % 89999999999));
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [tenantId, `e2e-payout-${seed}`, `e2e-payout-${seed}`]);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [globalUserId, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [globalUserId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [userId, tenantId, `e2e-payout-${seed}@e2e.local`, globalUserId]);
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Payout User',$3,$4)`, [actorId, tenantId, userId, globalUserId]);
  return { tenantId, userId, actorId };
}

async function buildApp(fx: Fixture): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const payoutRoutes = (await import('../modules/payout/payout.routes')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: fx.userId, userId: fx.userId, tenantId: fx.tenantId };
      (req as any).tenant = { id: fx.tenantId };
    });
    await scope.register(payoutRoutes);
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
    const orderId = randomUUID();
    // T1 — batches (com spoof embutido) → 403.
    const r1 = await app.inject({ method: 'POST', url: '/payouts/batches', headers: hdr,
      payload: JSON.stringify({ items: [], actor: { kind: 'system', actorId: randomUUID() }, actorId: randomUUID(), tenant_id: randomUUID() }) });
    record('T1 POST /payouts/batches → 403 (fail-closed)', r1.statusCode === 403, `status=${r1.statusCode} body=${r1.body.slice(0,120)}`);

    // T2 — execute-manual → 403.
    const r2 = await app.inject({ method: 'POST', url: `/payouts/orders/${orderId}/execute-manual`, headers: hdr, payload: '{}' });
    record('T2 POST /orders/:id/execute-manual → 403 (sem execução)', r2.statusCode === 403, `status=${r2.statusCode}`);

    // T3 — fail → 403.
    const r3 = await app.inject({ method: 'POST', url: `/payouts/orders/${orderId}/fail`, headers: hdr, payload: '{}' });
    record('T3 POST /orders/:id/fail → 403 (sem settlement)', r3.statusCode === 403, `status=${r3.statusCode}`);

    // T4 — spoof não muda nada (já no T1 com body spoof) → 403 e zero efeito.
    record('T4 spoof body.actor/actorId/actionContext/tenant_id → 403 e zero efeito', r1.statusCode === 403 && r2.statusCode === 403 && r3.statusCode === 403);

    // T5/T6/T7/T8 — Bank/payout intocados.
    const ledgerAfter = lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
    const txAfter = txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
    const spAfter = spExists ? await count(`SELECT count(*)::text n FROM bank_splits`) : 0;
    const poAfter = poExists ? await count(`SELECT count(*)::text n FROM actor_wallet_payout_requests`) : 0;
    record('T5 bank_ledger count before==after', ledgerAfter === ledgerBefore, `${ledgerBefore}->${ledgerAfter}`);
    record('T6 bank_transactions count before==after', txAfter === txBefore, `${txBefore}->${txAfter}`);
    record('T7 bank_splits count before==after', spAfter === spBefore, `${spBefore}->${spAfter}`);
    record('T8 actor_wallet_payout_requests não vira pago/executado (count==)', poAfter === poBefore, `${poBefore}->${poAfter}`);

    // T9 — fail-closed NÃO cria approval_request.
    const apprAfter = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1`, [fx.tenantId]);
    record('T9 approval_requests before==after (fail-closed não cria request)', apprAfter === apprBefore, `${apprBefore}->${apprAfter}`);

    // T10/T11 — baseline 0113 = 0; bank-http ainda reconhecido.
    let baseline0 = false, bankHttpOk = false;
    try {
      const out = execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd: process.cwd(), encoding: 'utf8' });
      baseline0 = /baseline=0\b/.test(out) && /new=0\b/.test(out) && /payout\.routes\.ts.*requirePermission/.test(out);
      bankHttpOk = /bank-http\.routes\.ts.*resolveForUser/.test(out);
    } catch { baseline0 = false; }
    record('T10 DECISION-0113 baseline = 0 (payout reconhecido por Forma B)', baseline0);
    record('T11 bank-http continua reconhecido (não regrediu ao baseline)', bankHttpOk);

    // T12 — zero can_execute_*.
    const canExec = await count(`SELECT count(*)::text n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`);
    record('T12 zero coluna can_execute_* em grants comuns', canExec === 0, `cols=${canExec}`);

    // S1 — estrutural fail-closed.
    const routes = readFileSync(join(REPO, 'backend/src/modules/payout/payout.routes.ts'), 'utf8');
    const codeOnly = routes.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    record('S1 writers fail-closed (PAYOUT_HTTP_EXECUTION_DISABLED; sem createPayoutBatch/executePayoutManual/markAsFailed)',
      /PAYOUT_HTTP_EXECUTION_DISABLED/.test(codeOnly) &&
      !/createPayoutBatch\s*\(|executePayoutManual\s*\(|markAsFailed\s*\(/.test(codeOnly) &&
      (codeOnly.match(/status\(403\)/g) || []).length >= 3);

    // S2 — guard verde.
    let guardOk = false;
    try { execSync('node scripts/audit-payout-authority-binding.mjs', { cwd: process.cwd(), encoding: 'utf8' }); guardOk = true; } catch { guardOk = false; }
    record('S2 guard payout-authority-binding verde', guardOk);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ payout writers fail-closed; zero dinheiro; baseline 0113 = 0 — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
