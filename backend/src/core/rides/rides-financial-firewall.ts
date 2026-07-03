// rides-financial-firewall.ts
// 🔴 F-RIDES-FINANCIAL-FIREWALL — contenção fail-closed do runtime financeiro do trilho de rides
// (processRidePayment → split 3% fee / 97% driver via o ledger do Bank).
//
// ACHADO B1 do auditoria.md (F-RIDES-FINANCIAL-FIREWALL, Clayton aprovou adicionar o firewall AGORA,
// 2026-07-02 — reverte a deferência guard-first da fatia F-RIDES-ANTIREVIVAL-GUARD-SLICE-A): o sink
// bankIntegrationService.processRidePayment (bank-integration.service.ts:912) escreve dinheiro REAL
// (createTransactionWithExplicitSplitLines → ledger/transactions/splits do Bank) e era o ÚNICO
// método money-sink do bank-integration SEM firewall — os de eventos (processEventTicketPayment /
// processEventConsumptionPayment) já têm assertCheckoutFinancialRuntimeEnabled. A contenção anterior
// era PURO dead-code (rotas financeiras de rides não-registradas em rides.module.ts) + o guard
// anti-reativação (audit-rides-money-antirevival-guard.mjs) — contenção de CAMADA ÚNICA (CI-time).
//
// Este firewall adiciona a defesa-em-profundidade RUNTIME que todos os outros trilhos têm (DECISION-
// 0110/0128): default OFF (fail-closed); NÃO move dinheiro; NÃO apaga código; lança 403 honesto ANTES
// de qualquer split/ledger. É SEPARADO dos demais flags (rides ≠ checkout ≠ serviço). Gate DUPLO
// (defesa-em-profundidade, espelha o padrão checkout caller+sink): no CALLER
// (distributionService.processRidePayment) E no SINK (bankIntegrationService.processRidePayment).
// Com isto, reativar rides financeiro vira ato DELIBERADO de 2 passos — registrar as rotas mortas
// (que o guard anti-reativação ainda morde) E ligar RIDES_FINANCIAL_RUNTIME_ENABLED='true' — nunca
// acidental. Reabrir = flag (revalidando a cadeia real de pagamento + auth), não reescrever. Money =
// PORTA-1/IA-DINHEIRO.

import { AppError } from '@core/errors';

export const RIDES_FINANCIAL_RUNTIME_FLAG = 'RIDES_FINANCIAL_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isRidesFinancialRuntimeEnabled(): boolean {
  return process.env[RIDES_FINANCIAL_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed do runtime financeiro de rides. Lança 403 HONESTO ANTES de qualquer split/ledger
 * (createTransactionWithExplicitSplitLines), enquanto o flag estiver OFF. NÃO move dinheiro; NÃO há
 * NODE_ENV auto-enable; NÃO há fail-open.
 */
export function assertRidesFinancialRuntimeEnabled(operation: string): void {
  if (isRidesFinancialRuntimeEnabled()) return;
  throw new AppError(
    403,
    `Runtime financeiro de rides desabilitado por contenção (F-RIDES-FINANCIAL-FIREWALL / achado B1; ` +
      `operação ${operation}) até a abertura soberana de dinheiro (PORTA-1) e a reativação governada do ` +
      'trilho de rides. Nenhum dinheiro é movido; nenhum split é escrito; o ledger do Bank não é tocado.',
    'RIDES_FINANCIAL_RUNTIME_DISABLED'
  );
}
