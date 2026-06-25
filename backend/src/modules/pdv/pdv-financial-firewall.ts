// pdv-financial-firewall.ts
// 🔴 F-PDV-PAY-MONEY-HOLD-CONTAINMENT — contenção fail-closed do runtime financeiro do PDV.
//
// ACHADO MATERIAL (3 paralelas READ-ONLY de F-UNIFIED-INVENTORY-PDV-READINESS): a rota viva autenticada
//   POST /pdv/orders/:orderId/pay → pdvService.payOrderFromPdv → createPaymentIntent + paymentIntentService
//   .authorizePaymentIntent + paymentExecutionService.executePayment → INSERT REAL em payment_intents/
//   bank_transactions/bank_ledger/bank_splits. Diferente do trilho de checkout/eventos, este caminho NÃO
//   estava atrás de firewall default-off — a única guarda era permission + representabilidade do seller.
//
// Este firewall ESPELHA o padrão de checkout-financial-firewall.ts / DECISION-0110: default OFF (fail-closed);
// NÃO move dinheiro; NÃO apaga código (o caminho fica preservado p/ auditoria + cadeia futura PORTA-1);
// NÃO finge operar — lança erro honesto ANTES de criar payment_intent / tocar bank_*. É SEPARADO do
// SERVICE_FINANCIAL_RUNTIME_ENABLED e do CHECKOUT_FINANCIAL_RUNTIME_ENABLED (trilho PDV ≠ serviço ≠ evento).
// Reabrir = trocar o flag (revalidando a cadeia canônica de pagamento), nunca reescrever.

import { AppError } from '@core/errors';

export const PDV_FINANCIAL_RUNTIME_FLAG = 'PDV_FINANCIAL_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isPdvFinancialRuntimeEnabled(): boolean {
  return process.env[PDV_FINANCIAL_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed do choke point de pagamento do PDV. Lança 403 HONESTO ANTES de qualquer createPaymentIntent
 * ou chamada a payment-execution/bank, enquanto o flag estiver OFF. NÃO move dinheiro. NÃO há NODE_ENV
 * auto-enable; NÃO há fail-open.
 */
export function assertPdvFinancialRuntimeEnabled(route: string): void {
  if (isPdvFinancialRuntimeEnabled()) return;
  throw new AppError(
    403,
    `Runtime financeiro do PDV desabilitado por contenção (F-PDV-PAY-MONEY-HOLD-CONTAINMENT; rota ${route}) ` +
      'até a abertura soberana de dinheiro (PORTA-1). Nenhum dinheiro é movido; payment_intents/bank_* não são tocados. ' +
      'O PDV segue vivo como CANAL operacional — só o pagamento está contido enquanto dinheiro está HOLD.',
    'PDV_FINANCIAL_RUNTIME_DISABLED'
  );
}
