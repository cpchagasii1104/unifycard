/**
 * E2E F-PDV-PAY-MONEY-HOLD-CONTAINMENT — contenção fail-closed do pagamento do PDV (dinheiro = HOLD / PORTA-1).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-pdv-pay-money-hold-containment-ephemeral.ps1.
 *
 * Prova que `pdvService.payOrderFromPdv` (chokepoint da rota POST /pdv/orders/:orderId/pay) FALHA FECHADO
 * com o flag PDV_FINANCIAL_RUNTIME_ENABLED ausente/default — ANTES de criar payment_intent ou tocar bank_*:
 *   • flag OFF → 403 PDV_FINANCIAL_RUNTIME_DISABLED, ANTES de qualquer side-effect;
 *   • zero payment_intents criados · Δbank=0 (ledger/transactions/splits/accounts);
 *   • flag controla o gate (com 'true' o firewall NÃO dispara — para numa etapa NÃO-financeira, sem tocar dinheiro);
 *   • estoque (inventory_movements) intocado pela rota bloqueada.
 * Money-free: NUNCA liga dinheiro real; com flag-on para ANTES de executePayment.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { pdvService } from '../modules/pdv/pdv.service';
import { PDV_FINANCIAL_RUNTIME_FLAG } from '../modules/pdv/pdv-financial-firewall';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/pdv|pay|money|hold|containment|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const dummyInput = () => ({
  sessionId: randomUUID(),
  orderId: randomUUID(),
  amountCents: 1000,
  currency: 'BRL',
  buyerActorId: randomUUID(),
  sellerActorId: randomUUID(),
});

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env[PDV_FINANCIAL_RUNTIME_FLAG]; // garante default-off

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const intentsBefore = await count(`SELECT count(*)::int AS n FROM payment_intents`);
  const moveBefore = await count(`SELECT (SELECT count(*) FROM inventory_movements)::int AS n`).catch(() => 0);

  // ── T1 — flag default-off → 403 PDV_FINANCIAL_RUNTIME_DISABLED (fail-closed) ──
  {
    let code: string | undefined; let status: number | undefined; let threw = false;
    try {
      await pdvService.payOrderFromPdv(randomUUID(), dummyInput() as any);
    } catch (e: any) {
      threw = true; code = e?.code; status = e?.statusCode;
    }
    record('T1 PDV-pay flag OFF → 403 PDV_FINANCIAL_RUNTIME_DISABLED (fail-closed)',
      threw && status === 403 && code === 'PDV_FINANCIAL_RUNTIME_DISABLED', `status=${status} code=${code}`);
  }

  // ── T2 — bloqueio ANTES de criar payment_intent ──
  record('T2 bloqueio ANTES de payment_intents (nenhum criado)', (await count(`SELECT count(*)::int AS n FROM payment_intents`)) === intentsBefore, `before=${intentsBefore}`);

  // ── T3 — Δbank=0 (ledger/transactions/splits/accounts intocados) ──
  record('T3 Δbank=0 (PDV-pay contido não escreve bank_*)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  // ── T4 — estoque intocado pela rota bloqueada ──
  const moveAfter = await count(`SELECT (SELECT count(*) FROM inventory_movements)::int AS n`).catch(() => 0);
  record('T4 inventory_movements intocado (contenção não mexe em estoque)', moveAfter === moveBefore, `before=${moveBefore} after=${moveAfter}`);

  // ── T5 — o flag CONTROLA o gate: com 'true' o firewall NÃO dispara (para numa etapa NÃO-financeira) ──
  {
    process.env[PDV_FINANCIAL_RUNTIME_FLAG] = 'true';
    let code: string | undefined; let msg = '';
    try {
      await pdvService.payOrderFromPdv(randomUUID(), dummyInput() as any);
    } catch (e: any) { code = e?.code; msg = e?.message || ''; }
    delete process.env[PDV_FINANCIAL_RUNTIME_FLAG]; // restaura default-off
    // com flag-on NÃO deve ser o erro de contenção — para numa etapa não-financeira (sessão inexistente),
    // sem tocar payment_intents/bank (não chegou a executePayment).
    const notContainment = code !== 'PDV_FINANCIAL_RUNTIME_DISABLED';
    const noMoney = (await count(`SELECT count(*)::int AS n FROM payment_intents`)) === intentsBefore && (await count(bankSql)) === bankBefore;
    record('T5 flag-on NÃO dispara contenção (gate é flag-controlado) e ainda não toca dinheiro', notContainment && noMoney, `code=${code} msg=${msg.slice(0, 60)}`);
  }

  // ── T6 — flag estrita: '1'/'TRUE'/'yes' NÃO ligam (fail-closed) ──
  {
    const { isPdvFinancialRuntimeEnabled } = await import('../modules/pdv/pdv-financial-firewall');
    const checks: boolean[] = [];
    for (const v of ['1', 'TRUE', 'yes', '', 'True']) { process.env[PDV_FINANCIAL_RUNTIME_FLAG] = v; checks.push(isPdvFinancialRuntimeEnabled() === false); }
    delete process.env[PDV_FINANCIAL_RUNTIME_FLAG]; checks.push(isPdvFinancialRuntimeEnabled() === false);
    process.env[PDV_FINANCIAL_RUNTIME_FLAG] = 'true'; const onlyTrue = isPdvFinancialRuntimeEnabled() === true; delete process.env[PDV_FINANCIAL_RUNTIME_FLAG];
    record('T6 flag estrita: só "true" liga (1/TRUE/yes/""/ausente = OFF)', checks.every(Boolean) && onlyTrue, `checks=${checks}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ PDV-pay fail-closed default-off ANTES de payment_intent/bank_*; Δbank=0; flag estrita; estoque intocado; dinheiro HOLD.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
