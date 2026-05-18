// backend/src/core/actor-coordination/recent-counterparts.types.ts
// 2026-05-18 P2 — Índice de Coordenação Humana — semente
//
// Tipos para agregação READ-ONLY de "contrapartes recentes" derivadas
// de SSOT financeiro existente (bank_splits). Implementa o primeiro
// sinal do Índice de Coordenação Humana definido na memória
// project_home_contextual_modelo_2026-05-18.md (P2 item 1).
//
// Princípio operacional: relação no UnifiCard emerge de comportamento
// (coordenação econômica rastreada), NÃO de declaração tipo Facebook.
// bank_splits é a fonte mais alta de valor — par economic direto com
// causalidade rastreável (transaction_id + amount_cents + created_at).
//
// V1 cobre apenas bank_splits. Sinais futuros (event_attendees co-presence,
// group_members co-membership, posts/reactions social) entram quando uso
// puxar — sem inflar.

/**
 * Contraparte recente — um actor com quem houve coordenação econômica
 * direta dentro da janela observada.
 */
export interface RecentCounterpart {
  /** ID do actor contraparte. */
  actorId: string;
  /** Tipo do actor contraparte (resolvido por JOIN com actors). */
  actorType: 'user' | 'page' | 'group' | 'channel';
  /** Nome de exibição da contraparte. */
  displayName: string;
  /** Avatar opcional. */
  avatarUrl: string | null;
  /** Número de transações nas duas direções (envio + recebimento). */
  interactionCount: number;
  /** Total movimentado em centavos (soma absoluta, ambas direções). */
  totalAmountCents: number;
  /** Data da interação mais recente (ISO). */
  lastInteractionAt: string;
  /** Janela observada em dias (parâmetro de input). */
  windowDays: number;
}

export interface RecentCounterpartsResponse {
  /** Actor cujas contrapartes foram resolvidas. */
  actorId: string;
  /** Janela temporal observada (dias). */
  windowDays: number;
  /** Lista de contrapartes ordenada por interactionCount DESC, lastInteractionAt DESC. */
  counterparts: RecentCounterpart[];
  /** Timestamp ISO da resolução. */
  resolvedAt: string;
  /** Identificação da fonte de sinal usada (v1: apenas bank_splits). */
  source: 'mvp-bank-splits-aggregation';
}
