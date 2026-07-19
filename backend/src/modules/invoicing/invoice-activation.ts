// src/modules/invoicing/invoice-activation.ts
// DECISION-0189B D7 — PORTA DE ATIVAÇÃO SEPARADA de invoices, FECHADA POR DEFAULT.
//
// O substrato de invoices NÃO existe (tabelas ghost). Enquanto não existir, TODAS as rotas de
// invoice respondem 503 controlado — a criação futura das tabelas NÃO abre as rotas
// automaticamente. Esta porta é EXPLÍCITA e independente do schema: `INVOICES_ACTIVATED` NUNCA é
// derivada de `to_regclass`/existência de tabela. Ativar = campanha própria (nova PermissionKey,
// fixtures reais não-vazias, E2E financeiro, reseal YALA) que flipa esta constante deliberadamente.

/** Porta de ativação — fechada por default. Abrir = decisão soberana de campanha própria. */
export const INVOICES_ACTIVATED = false;

/** Corpo 503 estável e sanitizado (sem detalhe interno). */
export const INVOICES_NOT_ACTIVATED_BODY = { ok: false, code: 'INVOICES_NOT_ACTIVATED' } as const;

/**
 * preHandler de porta: enquanto a porta estiver fechada, responde 503 estável ANTES de qualquer
 * consulta ao (inexistente) substrato — nada de 500 por tabela ghost, nada de auto-abertura.
 */
export function invoiceActivationGate() {
  return async (_req: unknown, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (!INVOICES_ACTIVATED) {
      return reply.status(503).send(INVOICES_NOT_ACTIVATED_BODY);
    }
    // porta aberta (futuro): segue o fluxo normal
    return undefined;
  };
}
