// event-settlement-financial-firewall.ts
// 🔴 F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT — contenção fail-closed do TRILHO financeiro de settlement de
// evento (create + read-by-event + transição PENDING → SETTLED).
//
// ACHADO ORIGINAL (READ-FIRST F-AUTHORITY-FACADE-COVERAGE-READINESS, HEAD 7e400ace): a rota viva autenticada
//   POST /events/:id/settlement/settle → eventSettlementService.settleEvent → eventSettlementRepository
//   .markAsSettled = `UPDATE event_settlements SET status='SETTLED'`. NÃO é money-write em bank_* (não toca
//   bank_transactions/bank_ledger; nenhum worker vivo consome SETTLED p/ transferir). MAS é uma transição de
//   ESTADO FINANCEIRO sensível, gateada SÓ por canRepresentActor — sem firewall, sem fachada/quarentena.
//
// ACHADO B2 do auditoria.md (F-EVENT-SETTLEMENT-GHOST-CONTAINMENT, Clayton escolheu CONTER, 2026-07-02): a
//   tabela `event_settlements` NÃO tem migration viva (CREATE só em migrations_archive/0215, e com 4 pontos de
//   DRIFT — tenants(tenant_id)/actors(actor_id) [PKs vivas=id], app.current_tenant_id [GUC vivo=app.current_tenant],
//   FK settlements(id) [tabela inexistente]). Havia MAIS DUAS superfícies vivas desta tabela-fantasma, além do
//   settle já contido: (1) INSERT via ticket.service.ts confirmTicketPayment → createFromEvent (SEM firewall,
//   mascarado só por try/catch que engolia o erro "relation does not exist"); (2) READ via GET
//   /events/:id/settlement → getSettlementByEvent (SEM firewall e SEM try/catch → 500 VIVO). A contenção agora
//   cobre as TRÊS superfícies fail-closed, tornando o gap HONESTO (era invisível até o pior momento).
//
// 🔴 ACOPLAMENTO TABELA↔FLAG (pré-condição de PORTA-1): ligar EVENT_SETTLEMENT_RUNTIME_ENABLED='true' SEM antes
//   materializar `event_settlements` (migration viva corrigindo os 4 drifts) faz TODAS as 3 superfícies
//   quebrarem em runtime (tabela inexistente). A materialização da tabela + abertura do flag é decisão soberana
//   de PORTA-1/IA-DINHEIRO (decision pack), NÃO ação de executora. Enquanto o flag estiver OFF, nenhum caminho
//   toca a tabela — o ghost é inerte por contenção, não por acidente.
//
// Este firewall ESPELHA checkout-financial-firewall / pdv-financial-firewall (DECISION-0110): default OFF
// (fail-closed); NÃO move dinheiro; NÃO apaga código; lança 403 honesto ANTES de tocar event_settlements. É
// SEPARADO dos flags de serviço/checkout/PDV (trilho de settlement de evento). Reabrir = trocar o flag +
// materializar a tabela, não reescrever.

import { AppError } from '@core/errors';

export const EVENT_SETTLEMENT_RUNTIME_FLAG = 'EVENT_SETTLEMENT_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isEventSettlementRuntimeEnabled(): boolean {
  return process.env[EVENT_SETTLEMENT_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed de QUALQUER operação do trilho de settlement de evento (create / read-by-event / settle).
 * Lança 403 HONESTO ANTES de qualquer acesso (INSERT / SELECT / UPDATE) a event_settlements, enquanto o flag
 * estiver OFF. NÃO move dinheiro; NÃO há NODE_ENV auto-enable; NÃO há fail-open. Enquanto contido, nenhum
 * caminho toca a tabela-fantasma — protege contra o gap "tabela inexistente" descrito no achado B2.
 */
export function assertEventSettlementRuntimeEnabled(operation: string): void {
  if (isEventSettlementRuntimeEnabled()) return;
  throw new AppError(
    403,
    `Operação do trilho de settlement de evento desabilitada por contenção ` +
      `(F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT / achado B2; operação ${operation}) até a abertura soberana ` +
      'de dinheiro (PORTA-1) e a materialização da tabela event_settlements. ' +
      'Nenhum dinheiro é movido; event_settlements não é lida nem escrita; bank_* não é tocado.',
    'EVENT_SETTLEMENT_RUNTIME_DISABLED'
  );
}
