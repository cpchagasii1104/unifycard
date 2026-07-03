/**
 * E2E F-RIDES-FINANCIAL-FIREWALL (achado B1 do auditoria.md).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-rides-financial-firewall-ephemeral.ps1.
 *
 * Prova que o runtime financeiro de rides (processRidePayment → split → bank_ledger) está
 * FAIL-CLOSED default-off nos DOIS gates (defesa-em-profundidade), ANTES de qualquer side-effect:
 *   • SINK bankIntegrationService.processRidePayment — flag ausente → 403 RIDES_FINANCIAL_RUNTIME_
 *     DISABLED (o firewall é a 1ª linha, antes de resolver contas / criar split / tocar ledger);
 *   • CALLER distributionService.processRidePayment — flag ausente → 403 (firewall é a 1ª linha,
 *     antes de qualquer leitura de driver/rides);
 *   • flag '1'/'TRUE'/'yes' → ainda OFF (estrito === 'true');
 *   • flag 'true' → o firewall DEIXA PASSAR → segue p/ downstream (erro DIFERENTE do firewall) —
 *     prova que não é fail-open e não é a única defesa, sem mover dinheiro;
 *   • Δbank=0 em todos os casos.
 * Money-free: o trilho de rides financeiro está morto (rotas não-registradas) + guard anti-reativação;
 * este firewall adiciona a defesa RUNTIME que faltava (paridade com os demais trilhos).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';
import { RIDES_FINANCIAL_RUNTIME_FLAG } from '../core/rides/rides-financial-firewall';
import { bankIntegrationService } from '../modules/bank/bank-integration.service';
import { DistributionService } from '../modules/rides/distribution/distribution.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/rides|firewall|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const FW_CODE = 'RIDES_FINANCIAL_RUNTIME_DISABLED';
const distributionService = new DistributionService();

// SINK: argumentos arbitrários — o firewall fira ANTES de resolver contas.
const callSink = () =>
  bankIntegrationService.processRidePayment(randomUUID(), {
    rideId: randomUUID(), passengerUserId: randomUUID(), driverUserId: randomUUID(), amountCents: 1000,
  }).then(() => ({ threw: false } as any)).catch((e) => ({ threw: true, err: errOf(e) }));

// CALLER: argumentos arbitrários — o firewall fira ANTES de qualquer leitura de driver/rides.
const callCaller = () =>
  distributionService.processRidePayment(randomUUID(), { id: randomUUID(), passenger_user_id: randomUUID(), driver_id: randomUUID() }, { totalCents: 1000 })
    .then(() => ({ threw: false } as any)).catch((e) => ({ threw: true, err: errOf(e) }));

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1/T2 — flag ausente → 403 firewall nos DOIS gates ──
  delete process.env[RIDES_FINANCIAL_RUNTIME_FLAG];
  {
    const r = await callSink();
    record('T1 SINK flag ausente → 403 RIDES_FINANCIAL_RUNTIME_DISABLED (antes de conta/split/ledger)',
      r.threw && r.err?.code === FW_CODE && r.err?.status === 403, JSON.stringify(r.err));
  }
  {
    const r = await callCaller();
    record('T2 CALLER flag ausente → 403 (gate duplo, defesa-em-profundidade; antes de ler driver/rides)',
      r.threw && r.err?.code === FW_CODE && r.err?.status === 403, JSON.stringify(r.err));
  }

  // ── T3 — estrito: '1'/'TRUE'/'yes' continuam OFF (nos dois gates) ──
  for (const v of ['1', 'TRUE', 'yes', 'True']) {
    process.env[RIDES_FINANCIAL_RUNTIME_FLAG] = v;
    const rs = await callSink();
    const rc = await callCaller();
    record(`T3 flag='${v}' → ainda OFF nos dois gates (estrito === 'true')`,
      rs.threw && rs.err?.code === FW_CODE && rc.threw && rc.err?.code === FW_CODE, `sink=${JSON.stringify(rs.err)} caller=${JSON.stringify(rc.err)}`);
  }

  // ── T4 — flag 'true' → firewall DEIXA PASSAR → downstream ≠ firewall (não fail-open) ──
  process.env[RIDES_FINANCIAL_RUNTIME_FLAG] = 'true';
  {
    const r = await callSink();
    record("T4 SINK flag='true' → firewall deixa passar (erro downstream ≠ firewall; não fail-open, money-free)",
      r.threw && r.err?.code !== FW_CODE, JSON.stringify(r.err));
  }
  {
    const r = await callCaller();
    record("T4b CALLER flag='true' → firewall deixa passar (erro downstream ≠ firewall)",
      r.threw && r.err?.code !== FW_CODE, JSON.stringify(r.err));
  }
  delete process.env[RIDES_FINANCIAL_RUNTIME_FLAG];

  // ── T5 — Δbank=0 após todos os casos ──
  record('T5 Δbank=0 (nenhum split/ledger criado em nenhum caso)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); await pool.end(); process.exit(1); }
  await pool.end();
  console.log('✨ rides money fail-closed default-off nos DOIS gates (sink+caller, 403 antes de tocar bank); estrito; flag-on deixa passar p/ downstream; Δbank=0. Achado B1 fechado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
