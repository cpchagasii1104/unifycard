// checkout-financial-firewall.ts
// 🔴 F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT — contenção fail-closed do runtime financeiro de checkout/eventos.
//
// ACHADO MATERIAL (preflight F-CHECKOUT-MOCK-MONEY-REACHABILITY): rotas vivas autenticadas
//   POST /api/checkout/event-ticket · POST /api/checkout/event-consumption · POST /events/:id/checkout
// alcançavam CheckoutService.processCheckout / eventEconomyService.processCheckout → mockUnifyCardCharge
// (always-success, sem validação) → bankIntegration.processEvent*Payment → INSERT REAL em bank_ledger/
// bank_transactions/bank_splits. A única "guarda" era `if NODE_ENV === 'production'` — dev/staging abertos.
// O firewall SERVICE_FINANCIAL_RUNTIME_ENABLED (DECISION-0110) NÃO cobre esses trilhos (só /services/*).
//
// Este firewall ESPELHA o padrão da DECISION-0110: default OFF (fail-closed); NÃO move dinheiro; NÃO apaga
// código (o caminho fica preservado p/ auditoria + cadeia futura); NÃO finge operar — lança erro honesto.
// É SEPARADO do SERVICE_FINANCIAL_RUNTIME_ENABLED (trilho de serviço ≠ trilho de evento/checkout). Reabrir =
// trocar o flag (revalidando auth/autorização da cadeia real de pagamento), não reescrever.

import { AppError } from '@core/errors';

export const CHECKOUT_FINANCIAL_RUNTIME_FLAG = 'CHECKOUT_FINANCIAL_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/qualquer-outro = desligado (fail-closed). */
export function isCheckoutFinancialRuntimeEnabled(): boolean {
  return process.env[CHECKOUT_FINANCIAL_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed para o choke point de checkout/eventos. Lança erro HONESTO (403) ANTES de qualquer mock
 * de cobrança ou chamada a bank-integration, enquanto o flag estiver OFF. NÃO move dinheiro.
 */
export function assertCheckoutFinancialRuntimeEnabled(route: string): void {
  if (isCheckoutFinancialRuntimeEnabled()) return;
  throw new AppError(
    403,
    'Runtime financeiro de checkout/eventos desabilitado por contenção (F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT) ' +
      'até a cadeia canônica de pagamento (cobrança real → liquidação governada) estar implementada e testada. ' +
      'Nenhum dinheiro é movido. Mock de cobrança não destrava liquidação real enquanto OFF.',
    'CHECKOUT_FINANCIAL_RUNTIME_DISABLED'
  );
}
