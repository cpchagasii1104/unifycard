/**
 * E2E F-DISPUTE-REVERSAL-AUTHORITY-BINDING-MODEL (DECISION_REQUIRED / HOLD).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-dispute-reversal-authority-model-ephemeral.ps1.
 *
 * NÃO reabilita nenhuma rota. Prova que o modelo definitivo exige decisão (permission-key + política
 * + Core de Aprovação Financeira p/ P0): as 4 rotas seguem 403 fail-closed; body.actor enviado pelo
 * cliente é IGNORADO (403 antes de parseActor/service); zero mutação em reconciliation_disputes/_events;
 * zero linha em reversals/bank_transactions/bank_ledger; contenções intactas.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import reconciliationDisputeRoutes from '../modules/reconciliation/reconciliation-dispute.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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
  if (!/dispute|reversal|authority|model|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bodyWithActor = { actor: { kind: 'system', actorId: randomUUID() }, ledger_discrepancy_id: randomUUID(), reason: 'spoof' };

  const app = Fastify();
  app.decorateRequest('tenant', null);
  app.decorateRequest('user', null);
  await app.register(reconciliationDisputeRoutes);
  await app.ready();

  const inject = async (url: string) => {
    const res = await app.inject({ method: 'POST', url, payload: bodyWithActor });
    let code: string | undefined; try { code = JSON.parse(res.body)?.code; } catch { /* noop */ }
    return { status: res.statusCode, code };
  };

  const id = randomUUID();
  // ── T1/T2/T3 — P1 mutations seguem 403 DISPUTE_MUTATION_HTTP_DISABLED (body.actor ignorado) ──
  for (const [label, url] of [
    ['from-discrepancy', '/disputes/from-discrepancy'],
    ['to-review', `/disputes/${id}/to-review`],
    ['resolve', `/disputes/${id}/resolve`],
  ] as const) {
    const r = await inject(url);
    record(`T(P1) ${label} → 403 DISPUTE_MUTATION_HTTP_DISABLED (body.actor ignorado)`, r.status === 403 && r.code === 'DISPUTE_MUTATION_HTTP_DISABLED', `status=${r.status} code=${r.code}`);
  }
  // ── T-P0 — /reversal segue 403 DISPUTE_REVERSAL_HTTP_DISABLED ──
  {
    const r = await inject(`/disputes/${id}/reversal`);
    record('T(P0) /reversal → 403 DISPUTE_REVERSAL_HTTP_DISABLED (continua disabled)', r.status === 403 && r.code === 'DISPUTE_REVERSAL_HTTP_DISABLED', `status=${r.status} code=${r.code}`);
  }
  await app.close();

  // ── T-body — body.actor não chega ao service: o handler não chama parseActor / service (estrutural) ──
  {
    const src = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const noParseActor = !/parseActor\s*\(/.test(src);
    const noServiceMutation = !/reconciliationDisputeService\.(createDisputeFromDiscrepancy|moveDisputeToUnderReview|resolveDispute|executeDisputeFinancialReversal)\s*\(/.test(src);
    record('T-body body.actor não alcança service (sem parseActor / service de mutação nos handlers)', noParseActor && noServiceMutation);
  }

  // ── T-state — zero mutação de estado de disputa ──
  record('T-state zero linha em reconciliation_disputes', (await count('SELECT count(*)::int AS n FROM reconciliation_disputes')) === 0);
  record('T-state zero linha em reconciliation_dispute_events', (await count('SELECT count(*)::int AS n FROM reconciliation_dispute_events')) === 0);

  // ── T-bank — zero linha financeira (reversals / bank) ──
  record('T-bank zero linha em reversals', (await count('SELECT count(*)::int AS n FROM reversals')) === 0);
  record('T-bank Bank intocado (bank_ledger + bank_transactions = 0)', (await count('SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n')) === 0);

  // ── T-intact — contenções anteriores (codes) e GET /events preservado ──
  {
    const src = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const mutationCodes = (src.match(/code: 'DISPUTE_MUTATION_HTTP_DISABLED'/g) || []).length === 3;
    const reversalCode = /code: 'DISPUTE_REVERSAL_HTTP_DISABLED'/.test(src);
    const eventsAlive = /\/disputes\/:id\/events/.test(src) && /listDisputeAuditEvents/.test(src);
    record('T-intact contenções intactas (3× mutation + 1× reversal) + GET /events preservado', mutationCodes && reversalCode && eventsAlive);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ Modelo definitivo exige decisão (permission-key/política + Core Aprovação Financeira P0); contenções 403 intactas; body.actor ignorado; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
