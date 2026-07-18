/**
 * E2E — Invoicing FAIL-CLOSED de disponibilidade (R-6 pós-YALA). Roda SÓ em DB efêmera. NUNCA unificard_dev.
 *
 * O módulo invoicing é schema-ghost: a tabela `invoices` só existe em migrations_archive/0212 (não
 * aplicada pelo runner oficial), então NÃO existe nem no dev nem na DB efêmera FULL. A YALA (C-1) achou
 * que o throw 422 vinha DEPOIS de consultar essa tabela → morria em 500 técnico. Este E2E prova a correção:
 *   A · `to_regclass('public.invoices')` = NULL na DB efêmera (schema-ghost confirmado);
 *   B · createInvoiceFromPayout → lança INVOICE_MODULE_UNAVAILABLE com statusCode 503 (não 500 acidental);
 *   C · issueInvoice → mesmo comportamento coerente (503 INVOICE_MODULE_UNAVAILABLE);
 *   D · getInvoiceById / listInvoices / getInvoiceByPayoutOrderId → todas 503 fail-closed;
 *   E · o erro acontece ANTES de qualquer linha em `invoices` (a tabela nem existe — zero consulta possível);
 *   F · Δbank=0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { invoiceService } from '../modules/invoicing/invoice.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/invoic|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function expect503(fn: () => Promise<unknown>): Promise<{ status: number | undefined; msg: string }> {
  try {
    await fn();
    return { status: 200, msg: 'NÃO LANÇOU (esperava 503)' };
  } catch (e: any) {
    return { status: e?.statusCode, msg: String(e?.message ?? e) };
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const TENANT = randomUUID();

  console.log('\n— invoicing fail-closed (schema-ghost → 503 INVOICE_MODULE_UNAVAILABLE) —');

  const bankBefore = (await pool.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
  )).rows[0].n;

  // A · schema-ghost confirmado
  const ghost = (await pool.query<{ t: string | null }>(`SELECT to_regclass('public.invoices')::text AS t`)).rows[0];
  record('A tabela `invoices` inexistente na DB efêmera (schema-ghost)', ghost.t === null, `to_regclass=${ghost.t}`);

  // B · createInvoiceFromPayout → 503 INVOICE_MODULE_UNAVAILABLE (não 500)
  const b = await expect503(() => invoiceService.createInvoiceFromPayout(TENANT, randomUUID(), { invoiceType: 'service_provider' } as any));
  record('B createInvoiceFromPayout → 503 INVOICE_MODULE_UNAVAILABLE (não 500 acidental)',
    b.status === 503 && /INVOICE_MODULE_UNAVAILABLE/.test(b.msg), `status=${b.status} msg=${b.msg.slice(0, 90)}`);

  // C · issueInvoice → coerente
  const c = await expect503(() => invoiceService.issueInvoice(TENANT, randomUUID(), { issuedByActorId: randomUUID() } as any));
  record('C issueInvoice → 503 INVOICE_MODULE_UNAVAILABLE (comportamento coerente)',
    c.status === 503 && /INVOICE_MODULE_UNAVAILABLE/.test(c.msg), `status=${c.status} msg=${c.msg.slice(0, 90)}`);

  // D · readers também fail-closed
  const d1 = await expect503(() => invoiceService.getInvoiceById(TENANT, randomUUID()));
  const d2 = await expect503(() => invoiceService.listInvoices(TENANT, {}));
  const d3 = await expect503(() => invoiceService.getInvoiceByPayoutOrderId(TENANT, randomUUID()));
  record('D getInvoiceById / listInvoices / getInvoiceByPayoutOrderId → todas 503 fail-closed',
    d1.status === 503 && d2.status === 503 && d3.status === 503,
    `byId=${d1.status} list=${d2.status} byPayout=${d3.status}`);

  // E · nenhuma alegação fiscal falsa / nenhum 500 acidental (todos os throws são 503 canônico)
  record('E indisponibilidade honesta (503), nunca 500 técnico nem 422 fiscal falso',
    [b, c, d1, d2, d3].every((r) => r.status === 503), JSON.stringify([b, c, d1, d2, d3].map((r) => r.status)));

  // F · Δbank=0
  const bankAfter = (await pool.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
  )).rows[0].n;
  record('F Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
