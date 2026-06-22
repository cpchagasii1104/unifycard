/**
 * F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT — E2E negativo. Prova fail-closed (flag default OFF):
 * ambos os choke points lançam CHECKOUT_FINANCIAL_RUNTIME_DISABLED ANTES de qualquer escrita, e ZERO
 * linhas novas em bank_ledger/bank_transactions/bank_splits. NÃO move dinheiro. Uso:
 *   pnpm exec tsx src/scripts/e2e-checkout-financial-containment.ts
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();
// garante OFF mesmo se o ambiente tiver setado (este e2e prova a contenção, não a operação)
delete process.env.CHECKOUT_FINANCIAL_RUNTIME_ENABLED;

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };
const throwsDisabled = async (fn: () => Promise<any>): Promise<string> => {
  try { await fn(); return 'NO_THROW'; }
  catch (e: any) { const s = `${e?.statusCode ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`; return /CHECKOUT_FINANCIAL_RUNTIME_DISABLED/.test(s) ? 'OK' : `WRONG:${e?.message}`; }
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { checkoutService } = await import('../core/checkout/CheckoutService');
  const { eventEconomyService } = await import('../core/events/event-economy.service');
  const { isCheckoutFinancialRuntimeEnabled } = await import('../core/checkout/checkout-financial-firewall');

  const c = await pool.connect();
  const count = async (t: string) => Number((await c.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n);
  try {
    ok(isCheckoutFinancialRuntimeEnabled() === false, '0. flag default OFF (fail-closed)');
    const before = { l: await count('bank_ledger'), t: await count('bank_transactions'), s: await count('bank_splits') };
    console.log(`    bank_* antes: ledger=${before.l} tx=${before.t} splits=${before.s}`);

    // choke point 1 — CheckoutService.processCheckout (rotas /api/checkout/*)
    ok((await throwsDisabled(() => checkoutService.processCheckout(TENANT, {
      amount: 10000, currency: 'BRL', paymentMethod: 'UNIFYCARD', idempotencyKey: 'e2e-contain-1',
      context: { module: 'EVENT_TICKET', globalUserId: '00000000-0000-0000-0000-000000000000', eventId: '00000000-0000-0000-0000-000000000000' },
    } as any))) === 'OK', '1. CheckoutService.processCheckout → CHECKOUT_FINANCIAL_RUNTIME_DISABLED');

    // choke point 2 — eventEconomyService.processCheckout (rota /events/:id/checkout)
    ok((await throwsDisabled(() => eventEconomyService.processCheckout(TENANT, {
      eventId: '00000000-0000-0000-0000-000000000000', attendeeActorId: '00000000-0000-0000-0000-000000000000', quantity: 1,
    } as any))) === 'OK', '2. eventEconomyService.processCheckout → CHECKOUT_FINANCIAL_RUNTIME_DISABLED');

    const after = { l: await count('bank_ledger'), t: await count('bank_transactions'), s: await count('bank_splits') };
    console.log(`    bank_* depois: ledger=${after.l} tx=${after.t} splits=${after.s}`);
    ok(after.l === before.l && after.t === before.t && after.s === before.s,
      `3. ZERO escrita em bank_ledger/transactions/splits (Δ ledger=${after.l - before.l} tx=${after.t - before.t} splits=${after.s - before.s})`);
  } finally {
    c.release();
  }
  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'CHECKOUT CONTIDO FAIL-CLOSED ✅ (zero dinheiro)' : 'FALHAS: ' + fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
