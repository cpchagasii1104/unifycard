/**
 * E2E F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-event-settlement-status-hold-containment-ephemeral.ps1.
 *
 * Prova que a transição de estado do settlement de evento (settleEvent → markAsSettled:
 * event_settlements.status='SETTLED') está FAIL-CLOSED default-off ANTES de qualquer side-effect:
 *   • flag ausente → 403 EVENT_SETTLEMENT_RUNTIME_DISABLED (o firewall é a 1ª linha de settleEvent);
 *   • flag '1' / 'TRUE' / 'yes' → ainda OFF (estrito === 'true');
 *   • flag 'true' → o firewall DEIXA PASSAR → settleEvent segue para o downstream (erro DIFERENTE do firewall) —
 *     prova que o gate não é fail-open e não é a única defesa, sem mover dinheiro;
 *   • Δbank=0 em todos os casos (settle NÃO toca bank_*).
 * NOTA: event_settlements é GHOST no schema vivo (DDL só em migrations_archive); este firewall torna a
 * contenção EXPLÍCITA (403 por HOLD) em vez de acidental (42P01 da tabela ausente). Money-free.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';
import { eventSettlementService } from '../modules/marketplace/event-settlement.service';
import { EVENT_SETTLEMENT_RUNTIME_FLAG } from '../modules/marketplace/event-settlement-financial-firewall';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/event|settlement|hold|containment|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

// chama settleEvent com argumentos arbitrários (o firewall fira ANTES de qualquer leitura de settlement).
const callSettle = () =>
  eventSettlementService.settleEvent(randomUUID(), randomUUID(), { settlementId: undefined }, randomUUID(), randomUUID())
    .then(() => ({ threw: false } as any))
    .catch((e) => ({ threw: true, err: errOf(e) }));

const FW_CODE = 'EVENT_SETTLEMENT_RUNTIME_DISABLED';

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1 — flag ausente → 403 firewall (fail-closed, antes de markAsSettled) ──
  delete process.env[EVENT_SETTLEMENT_RUNTIME_FLAG];
  {
    const r = await callSettle();
    record('T1 flag ausente → 403 EVENT_SETTLEMENT_RUNTIME_DISABLED (fail-closed, firewall é a 1ª linha)',
      r.threw && r.err?.code === FW_CODE && r.err?.status === 403, JSON.stringify(r.err));
  }

  // ── T2/T3 — estrito: '1' e 'TRUE' continuam OFF ──
  for (const v of ['1', 'TRUE', 'yes', 'True']) {
    process.env[EVENT_SETTLEMENT_RUNTIME_FLAG] = v;
    const r = await callSettle();
    record(`T2 flag='${v}' → ainda OFF (403 firewall; estrito === 'true')`, r.threw && r.err?.code === FW_CODE, JSON.stringify(r.err));
  }

  // ── T4 — flag 'true' → firewall DEIXA PASSAR → erro DIFERENTE do firewall (não fail-open; downstream ghost) ──
  process.env[EVENT_SETTLEMENT_RUNTIME_FLAG] = 'true';
  {
    const r = await callSettle();
    record('T4 flag=\'true\' → firewall deixa passar (erro downstream ≠ firewall; não é a única defesa, money-free)',
      r.threw && r.err?.code !== FW_CODE, JSON.stringify(r.err));
  }
  delete process.env[EVENT_SETTLEMENT_RUNTIME_FLAG];

  // ── T5 — Δbank=0 (settle não toca bank_*) ──
  record('T5 Δbank=0 (settle não move dinheiro; zero bank_transactions/ledger criados)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  // ── T6 — confirmação: event_settlements é ghost no schema vivo (contenção explícita > acidental) ──
  {
    const exists = await count(`SELECT (to_regclass('public.event_settlements') IS NOT NULL)::int AS n`);
    record('T6 event_settlements ghost no FULL → o firewall é a contenção EXPLÍCITA (403), não a acidental (42P01)', exists === 0, `to_regclass!=null? ${exists}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ settle fail-closed default-off (403 antes de markAsSettled); estrito; flag-on deixa passar p/ downstream ghost; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
