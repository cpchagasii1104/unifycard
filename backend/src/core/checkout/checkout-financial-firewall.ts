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

/**
 * 🔴 PRÉ-CONDIÇÕES DE ABERTURA — ligar o flag com esta lista NÃO-VAZIA é recusado.
 *
 * Por que existe: a contenção deste firewall estava correta, mas a ORDEM de reabertura vivia só em
 * prosa no cartório — e prosa não morde. Cada item aqui é um defeito que HOJE é inofensivo APENAS
 * porque o flag está OFF, e que vira defeito de dinheiro no instante em que ele for ligado.
 *
 * Regra (CLAUDE.md §2.1): allowlist que pode CRESCER é permissão; esta só pode ENCOLHER — é dívida
 * com saída. Fechou o item? Remova a entrada, e o commit que a remove carrega a prova.
 * ⛔ NUNCA esvazie esta lista para "destravar o flag". Esvaziar sem consertar é reabrir a porta que
 * a contenção fechou, com a diferença de que agora ninguém mais vai perceber.
 */
export const CHECKOUT_FINANCIAL_OPEN_PRECONDITIONS: ReadonlyArray<{
  readonly id: string;
  readonly what: string;
  readonly verify: string;
}> = [
  {
    id: 'G0-FROM-PRICE-COHERENCE',
    what:
      'As telas de compra e do feed exibem events.ticket_price_cents cru, sem olhar event_sectors. ' +
      'Decisão (B) de Clayton: esse campo é um "a partir de" — e o "a partir de" TEM de SER o menor ' +
      'inteira_price_cents quando há setores (igualdade, não "≤": 5000 ≤ 8000 satisfaz um "≤" e mente ' +
      'do mesmo jeito). Medido em 2026-08-01: 1 de 3 eventos com setor anuncia R$50 com mínimo real ' +
      'de R$80. Hoje é dívida de UI porque nada é cobrado; com o flag ON, é cobrança pelo valor errado.',
    verify:
      "SELECT e.id, e.ticket_price_cents, MIN(s.inteira_price_cents) FROM events e " +
      'JOIN event_sectors s ON s.event_id = e.id GROUP BY e.id, e.ticket_price_cents ' +
      'HAVING e.ticket_price_cents <> MIN(s.inteira_price_cents);  -- tem de voltar VAZIO',
  },
];

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/qualquer-outro = desligado (fail-closed). */
export function isCheckoutFinancialRuntimeEnabled(): boolean {
  return process.env[CHECKOUT_FINANCIAL_RUNTIME_FLAG] === 'true';
}

/**
 * Gate fail-closed para o choke point de checkout/eventos. Lança erro HONESTO (403) ANTES de qualquer mock
 * de cobrança ou chamada a bank-integration, enquanto o flag estiver OFF. NÃO move dinheiro.
 */
export function assertCheckoutFinancialRuntimeEnabled(route: string): void {
  if (isCheckoutFinancialRuntimeEnabled()) {
    // Flag ON não basta: as pré-condições de abertura têm de estar fechadas. Ligar o flag com dívida
    // aberta faria o sistema COBRAR com o defeito que só era inofensivo enquanto ele estava OFF.
    if (CHECKOUT_FINANCIAL_OPEN_PRECONDITIONS.length > 0) {
      throw new AppError(
        403,
        `Runtime financeiro de checkout LIGADO com pré-condição de abertura ABERTA em ${route}. ` +
          'Não é o flag que está errado — é a ordem. Feche e remova de CHECKOUT_FINANCIAL_OPEN_PRECONDITIONS: ' +
          CHECKOUT_FINANCIAL_OPEN_PRECONDITIONS.map((p) => `${p.id} (${p.what})`).join(' | '),
        'CHECKOUT_FINANCIAL_PRECONDITION_OPEN'
      );
    }
    return;
  }
  throw new AppError(
    403,
    'Runtime financeiro de checkout/eventos desabilitado por contenção (F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT) ' +
      'até a cadeia canônica de pagamento (cobrança real → liquidação governada) estar implementada e testada. ' +
      'Nenhum dinheiro é movido. Mock de cobrança não destrava liquidação real enquanto OFF.',
    'CHECKOUT_FINANCIAL_RUNTIME_DISABLED'
  );
}
