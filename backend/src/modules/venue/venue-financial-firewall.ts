// venue-financial-firewall.ts
// 🔴 F-VENUE-PAY-MONEY-HOLD-CONTAINMENT — contenção fail-closed do runtime financeiro do venue.
//
// ACHADO MATERIAL (verificação de V3 do parecer sobre a re-auditoria Yala, 2026-07-05): a rota
//   PÚBLICA (sem autenticação, "público, rate limit") POST /t/:qrToken/orders/:orderId/pay →
//   paymentExecutionService.executePayment, SEM nenhum firewall default-off — diferente do PDV
//   (mesmo sink) e do checkout/eventos, que já têm o padrão. O caminho hoje só aceita PIX/
//   UNIFYCARD (ambos não tocam bank_ledger real — PIX é cobrança externa, UNIFYCARD é
//   explicitamente simulado, "Capturar imediatamente (simulação)" em payment-execution.service.ts)
//   — mas a AUSÊNCIA do firewall é uma landmine: se o branch de método de pagamento for
//   expandido no futuro (ex.: liberar o branch real de escrow), a rota pública já estaria pronta
//   pra mover dinheiro sem trava nenhuma.
//
// Este firewall ESPELHA pdv-financial-firewall.ts / checkout-financial-firewall.ts / DECISION-0110:
// default OFF (fail-closed); NÃO move dinheiro; NÃO apaga código; NÃO finge operar — lança erro
// honesto ANTES de criar payment_intent / tocar bank_*. É SEPARADO dos demais flags de domínio
// (trilho venue ≠ PDV ≠ serviço ≠ evento). Reabrir = trocar o flag, nunca reescrever.

import { AppError } from '@core/errors';

export const VENUE_FINANCIAL_RUNTIME_FLAG = 'VENUE_FINANCIAL_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isVenueFinancialRuntimeEnabled(): boolean {
  return process.env[VENUE_FINANCIAL_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed do choke point de pagamento do venue. Lança 403 HONESTO ANTES de qualquer
 * createPaymentIntent ou chamada a payment-execution/bank, enquanto o flag estiver OFF. NÃO move
 * dinheiro. NÃO há NODE_ENV auto-enable; NÃO há fail-open.
 */
export function assertVenueFinancialRuntimeEnabled(route: string): void {
  if (isVenueFinancialRuntimeEnabled()) return;
  throw new AppError(
    403,
    `Runtime financeiro do venue desabilitado por contenção (F-VENUE-PAY-MONEY-HOLD-CONTAINMENT; rota ${route}) ` +
      'até a abertura soberana de dinheiro (PORTA-1). Nenhum dinheiro é movido; payment_intents/bank_* não são tocados. ' +
      'O venue segue vivo como CANAL operacional (comanda/QR) — só o pagamento está contido enquanto dinheiro está HOLD.',
    'VENUE_FINANCIAL_RUNTIME_DISABLED'
  );
}
