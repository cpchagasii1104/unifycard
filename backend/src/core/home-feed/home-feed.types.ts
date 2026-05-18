// backend/src/core/home-feed/home-feed.types.ts
// 2026-05-18 P2 — Feed multi-vetor v1 (semente)
//
// Tipos para a queue ordenada da home contextual definida na memória
// project_home_contextual_modelo_2026-05-18.md (§3 Feed + 6 vetores).
//
// V1 cobre 2 vetores: Compromisso (event_reservations) + Convite
// (group_invites). Outros vetores (Recorrência, Oportunidade,
// Descoberta, Momento) entram conforme uso real puxar — sem inflar.
//
// Princípio operacional: home-feed é PROJEÇÃO DERIVADA. NÃO possui
// verdade própria. Lê SSOT de cada fonte (events, event_reservations,
// group_invites). Cada item declara sua causalidade ao usuário.

/** Vetor canônico — string literal para tipagem; lista vinculada à memória institucional. */
export type FeedVector =
  | 'compromisso'
  | 'convite'
  | 'recorrencia'
  | 'oportunidade'
  | 'descoberta'
  | 'momento';

export type FeedTemperature = 'quente' | 'morna' | 'fria';
export type FeedScope = 'solo' | 'celula' | 'bairro' | 'ecossistema';

/**
 * Item da home — referência materializada a entidade soberana existente
 * + causalidade declarada ao usuário.
 */
export interface HomeItem {
  /** Vetor canônico (6 possíveis; v1 só emite 2). */
  vetor: FeedVector;
  /** Frase humana — POR QUE este item aparece. Princípio §1: causalidade declarada. */
  causalidade: string;
  /** Escopo de densidade — solo/celula/bairro/ecossistema. */
  escopo: FeedScope;
  /** Quando o item expira (auto-some). null se sem expiração explícita. */
  expiraEm: string | null;
  /** Temperatura técnica do item — define cache/latência/realtime. */
  temperatura: FeedTemperature;
  /** Referência verificável em SSOT material — frontend pode navegar. */
  ancoragemMaterial: {
    tipo: 'event_reservation' | 'group_invite' | 'recurring_pattern';
    id: string;
    /** Metadados opcionais — apenas para projeção UX. NUNCA para decisão crítica. */
    extra?: Record<string, unknown>;
  };
  /** Rota frontend sugerida (UX hint). Opcional. */
  rotaSugerida?: string;
}

export interface HomeFeedResponse {
  actorId: string;
  /** Queue ordenada (limite curto — princípio §6 anti-cockpit visual). */
  items: HomeItem[];
  /** Vetores efetivamente compostos nesta resolução. */
  vetoresAtivos: FeedVector[];
  resolvedAt: string;
  source: 'mvp-multi-vetor-v1';
}
