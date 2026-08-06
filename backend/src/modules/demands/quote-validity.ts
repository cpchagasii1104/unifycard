// backend/src/modules/demands/quote-validity.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — LEITOR ÚNICO de "este orçamento ainda vale?"
// ║ NORMA:   DECISION_0196 §C/D1 (validade) e §C/D2 (vencido morre, não renova)
// ║ NÃO:     NÃO comparar `expires_at` com `now()` fora daqui — nem em SQL, nem em tela
// ║ EM VEZ:  importar `isQuoteExpired` / `assertQuoteUsable` deste módulo
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE UM MÓDULO PARA UMA COMPARAÇÃO DE DUAS DATAS ═══
// Porque a comparação não é o problema — a DIVERGÊNCIA é. Em 2026-08-05 este repositório pagou
// exatamente isso com `free-time`: a pergunta *"este horário está livre?"* tinha DUAS respostas, e
// quem estivesse errado venderia o mesmo bem duas vezes. A regra que saiu de lá foi promovida a
// exigência no plano do orçamento (`organizacaoevento.md §4⑥`):
//
//     "UMA função responde 'este orçamento ainda vale', e todos importam dela.
//      Derivação copiada em N telas diverge."
//
// ═══ EXPIRAÇÃO PREGUIÇOSA — `expirado` NUNCA é gravado ═══
// Não existe status `expired` em `service_demand_responses` (o CHECK vivo é
// pending|accepted|chosen|rejected|withdrawn) e NÃO deve existir: gravar o vencimento exigiria um
// worker, e worker que não roda produz orçamento vencido que o sistema jura estar vivo.
// O estado é **DERIVADO na leitura** e **IMPOSTO no aceite** — o precedente é `group_invites`, que
// expira na leitura sem worker nenhum (verificado em 2026-08-05).
//
// ═══ D2 — VENCIDO MORRE, NÃO RENOVA ═══
// Não existe `renovar`. Empurrar `expires_at` faria o histórico **mentir sobre o que o cliente viu
// quando decidiu**. Vencido ⇒ o fornecedor responde de novo, e nasce outra resposta.
//
// 🔴 READ-ONLY: este módulo RESPONDE. Não persiste, não decide, não emite evento.

/** Erro nomeado do aceite de orçamento vencido. `statusCode` casa o formato do módulo (409). */
export class QuoteExpiredError extends Error {
  readonly statusCode = 409;
  readonly code = 'QUOTE_EXPIRED';
  constructor(expiresAt: Date | string) {
    super(
      `QUOTE_EXPIRED: este orçamento venceu em ${new Date(expiresAt).toISOString()} e não pode mais ` +
      `ser aceito. Vencido não renova (DECISION-0196 §C/D2) — peça um novo orçamento ao fornecedor.`
    );
    this.name = 'QuoteExpiredError';
  }
}

/**
 * A pergunta, em um lugar só: este orçamento ainda vale NESTE instante?
 * `now` é injetável para que a prova não dependa do relógio — nunca para "congelar" produção.
 */
export function isQuoteExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const limite = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  // Intervalo meio-aberto, mesma semântica temporal do resto do sistema (0146 G8): o instante
  // exato do vencimento ainda VALE; a partir dele, não.
  return now.getTime() > limite.getTime();
}

/**
 * IMPOSIÇÃO no aceite — a outra metade da expiração preguiçosa.
 * Derivar na leitura sem impor no aceite deixaria a tela honesta e o motor permissivo: alguém
 * aceitaria por uma aba velha, e o compromisso nasceria de um preço que já não vale.
 */
export function assertQuoteUsable(expiresAt: Date | string, now: Date = new Date()): void {
  if (isQuoteExpired(expiresAt, now)) throw new QuoteExpiredError(expiresAt);
}
