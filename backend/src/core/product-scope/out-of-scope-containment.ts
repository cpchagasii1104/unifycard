// backend/src/core/product-scope/out-of-scope-containment.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 — registrada no REMEDIATION_DT_LOG.md
// ║ NÃO:     tratar módulo fora do mínimo como "dívida técnica" ou "bug". NÃO materializar
// ║          tabela/coluna/migration pra fazer um módulo fora do mínimo funcionar — materializar
// ║          é forward-only e NÃO volta. NÃO apagar módulo/arquivo/rota (ato de Clayton).
// ║ EM VEZ:  contenção 501 nomeada NA BORDA (hook onRequest — dispara ANTES do handler, logo antes
// ║          de qualquer service/SQL), dizendo em voz alta que é ESCOPO NÃO INICIADO, não defeito.
// ║          Reversível por desenho: religar = apagar a UMA linha de `addHook` do arquivo de rota
// ║          + materializar o substrato do archive com GATE. Custo em horas, não em dias.
// ╚════════════════════════════════════════════════════════════════
//
// O MÍNIMO DE PRODUTO (Clayton, 2026-08-01) — o que precisa existir pra demonstrar a UNIFICAÇÃO:
//   rede social · banco · cartão · compra/venda · locação · ingressos/shows/eventos · serviços
// Tudo fora disso é ESCOPO NÃO INICIADO. A diferença importa: dívida técnica se conserta;
// escopo não iniciado se INICIA — e a decisão de iniciar é de Clayton, não de quem passa por aqui.

import type { FastifyReply, FastifyRequest } from 'fastify';

export const PRODUCT_MINIMUM: readonly string[] = [
  'rede social',
  'banco',
  'cartão',
  'compra/venda',
  'locação',
  'ingressos/shows/eventos',
  'serviços',
] as const;

/** Por que este módulo está contido. São razões DIFERENTES e não devem ser confundidas. */
export type ContainmentReason =
  /** Fora do mínimo de produto (Clayton, 2026-08-01). Não é defeito — é escopo não iniciado. */
  | 'out_of_product_minimum'
  /** Revogado por LEI (ex.: CONTRATO_GRUPOS_V2). Mais forte que escopo: não se "reabre" por decisão de fatia. */
  | 'revoked_by_law';

export interface OutOfScopeContainmentInput {
  /** Nome do módulo, como aparece no roteamento (ex.: 'presence', 'work', 'pilot'). */
  module: string;
  reason: ContainmentReason;
  /** Substrato que faltaria pra este módulo funcionar (tabelas/funções medidas ausentes). */
  missingSubstrate: string[];
  /** Só para `revoked_by_law`: o documento que revoga. */
  revokedBy?: string;
}

const HOW_TO_REOPEN_SCOPE =
  'Reopening is REVERSIBLE and costs hours, not days: remove the single addHook line from this ' +
  "module's routes file AND materialize the substrate from backend/migrations_archive with a GATE " +
  '(never by hand-writing a migration to fit the caller). Nothing was deleted; the handlers are intact.';

const HOW_TO_REOPEN_LAW =
  'This module is NOT reopenable by a slice decision: it was revoked by law. Reopening requires ' +
  'amending the governing document first, then a GATE. The handlers are intact but must stay unreachable.';

export function buildContainmentBody(input: OutOfScopeContainmentInput): Record<string, unknown> {
  const isLaw = input.reason === 'revoked_by_law';
  const code = isLaw ? 'MODULE_REVOKED_BY_LAW' : 'MODULE_OUT_OF_PRODUCT_MINIMUM';
  return {
    ok: false,
    code,
    error: code,
    module: input.module,
    reason: isLaw
      ? `Module "${input.module}" was REVOKED BY LAW (${input.revokedBy ?? 'see governing document'}). ` +
        'It is not broken and not pending — it is forbidden.'
      : `Module "${input.module}" is OUTSIDE the product minimum decided by the owner on 2026-08-01. ` +
        'It is NOT broken and NOT technical debt — it is scope that has not been started. The product ' +
        `minimum is: ${PRODUCT_MINIMUM.join(' · ')}.`,
    missing_substrate: input.missingSubstrate,
    how_to_reopen: isLaw ? HOW_TO_REOPEN_LAW : HOW_TO_REOPEN_SCOPE,
    reversible: !isLaw,
    money_moved: false,
  };
}

/**
 * Contém um módulo inteiro NA BORDA, sem tocar em handler nenhum.
 *
 * Uso — UMA linha, no topo do plugin de rotas do módulo:
 *   fastify.addHook('onRequest', containModule({ module: 'presence', reason: '...', ... }));
 *
 * `addHook` chamado no escopo do plugin de rotas vale SÓ pra esse plugin (encapsulamento do
 * Fastify — não vaza pro resto do app) e dispara ANTES do handler, logo antes de qualquer
 * service/SQL. Apagar a linha religa o módulo inteiro; nenhum handler foi tocado.
 */
export function containModule(
  input: OutOfScopeContainmentInput
): (req: FastifyRequest, reply: FastifyReply) => Promise<never> {
  const body = buildContainmentBody(input);
  return async (_req: FastifyRequest, reply: FastifyReply): Promise<never> => {
    reply.header('Cache-Control', 'no-store');
    return reply.status(501).send(body) as never;
  };
}
