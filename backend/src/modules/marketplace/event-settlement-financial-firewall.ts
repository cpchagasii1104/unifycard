// event-settlement-financial-firewall.ts
// 🔴 F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT — contenção fail-closed da TRANSIÇÃO de estado financeiro do
// settlement de evento (PENDING → SETTLED).
//
// ACHADO MATERIAL (READ-FIRST F-AUTHORITY-FACADE-COVERAGE-READINESS, HEAD 7e400ace): a rota viva autenticada
//   POST /events/:id/settlement/settle → eventSettlementService.settleEvent → eventSettlementRepository
//   .markAsSettled = `UPDATE event_settlements SET status='SETTLED'`. NÃO é money-write em bank_* (não toca
//   bank_transactions/bank_ledger; nenhum worker vivo consome SETTLED p/ transferir). MAS é uma transição de
//   ESTADO FINANCEIRO sensível, gateada SÓ por canRepresentActor — sem firewall, sem fachada/quarentena.
//
// Este firewall ESPELHA checkout-financial-firewall / pdv-financial-firewall (DECISION-0110): default OFF
// (fail-closed); NÃO move dinheiro; NÃO apaga código; lança 403 honesto ANTES de markAsSettled. É SEPARADO dos
// flags de serviço/checkout/PDV (trilho de settlement de evento). Reabrir = trocar o flag, não reescrever.

import { AppError } from '@core/errors';

export const EVENT_SETTLEMENT_RUNTIME_FLAG = 'EVENT_SETTLEMENT_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isEventSettlementRuntimeEnabled(): boolean {
  return process.env[EVENT_SETTLEMENT_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed da transição de estado do settlement de evento. Lança 403 HONESTO ANTES de qualquer
 * markAsSettled / UPDATE event_settlements, enquanto o flag estiver OFF. NÃO move dinheiro; NÃO há NODE_ENV
 * auto-enable; NÃO há fail-open.
 */
export function assertEventSettlementRuntimeEnabled(route: string): void {
  if (isEventSettlementRuntimeEnabled()) return;
  throw new AppError(
    403,
    `Transição de estado do settlement de evento desabilitada por contenção ` +
      `(F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT; rota ${route}) até a abertura soberana de dinheiro (PORTA-1). ` +
      'Nenhum dinheiro é movido; event_settlements.status não muda; bank_* não é tocado.',
    'EVENT_SETTLEMENT_RUNTIME_DISABLED'
  );
}
