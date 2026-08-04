// backend/src/modules/events/event.types.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

/**
 * Status do evento
 */
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

/**
 * Tipo de ingresso
 */
export type EventTicketType = 'GENERAL' | 'VIP' | 'BACKSTAGE';

/**
 * Status da venda de ingresso
 * Alinhado com schema (C64 fix): pending/completed/refunded/failed
 */
export type TicketSaleStatus = 'pending' | 'completed' | 'refunded' | 'failed';

/**
 * Evento
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Evento ≠ Order
 * - Tudo explícito, auditável e declarativo
 */
export interface Event {
  id: string;
  tenantId: string;
  organizerActorId: string;
  title: string;
  description: string | null;
  locationActorId: string | null;
  startAt: Date;
  endAt: Date;
  status: EventStatus;
  /**
   * Status REAL da coluna events.status (vocabulário governado, minúsculo:
   * draft·declared·published·active·ended·cancelled).
   * 🔴 Existe porque `status` acima é o vocabulário LEGADO deste módulo e PERDE informação:
   * published, declared e active colapsam num único 'PUBLISHED'. Quem precisa distinguir
   * "declarado mas não publicado" de "publicado de fato" TEM de ler este campo.
   */
  statusCanonical?: string;
  publishedAt: Date | null;
  publishedByActorId: string | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  /**
   * 🔴 2026-08-04 — a query da lista SEMPRE trouxe estas colunas e o mapper NUNCA as projetava.
   * A vitrine precisa do preço para distinguir "Entrada gratuita" de "R$ 60,00" com honestidade;
   * sem o campo, `undefined` cairia no ramo do gratuito e a tela mentiria sobre DINHEIRO.
   * `_cents`: inteiro, nunca float (07_NOMENCLATURA §4.7). `null` = sem ingresso pago.
   */
  ticketPriceCents?: number | null;
  maxAttendees?: number | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar evento
 */
export interface CreateEventInput {
  organizerActorId: string;
  title: string;
  description?: string;
  locationActorId?: string;
  startAt: Date | string;
  endAt: Date | string;
  /** Taxonomia (≠ `visibility`). Default no repositório: `general`. */
  eventType?: string;
  /** IANA; default `UTC`. */
  timezone?: string;
  metadata?: Record<string, any>;
}

/**
 * Tipo de ingresso
 */
export interface EventTicket {
  id: string;
  tenantId: string;
  eventId: string;
  ticketType: EventTicketType;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar tipo de ingresso
 */
export interface CreateEventTicketInput {
  ticketType: EventTicketType;
  priceCents: number;
  currency?: string;
  quantityTotal: number;
  metadata?: Record<string, any>;
}

/**
 * Venda de ingresso
 */
export interface TicketSale {
  id: string;
  tenantId: string;
  eventTicketId: string;
  buyerActorId: string;
  paymentIntentId: string | null;
  status: TicketSaleStatus;
  reservedAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para reservar ingresso
 */
export interface ReserveTicketInput {
  buyerActorId: string;
  paymentMethodId?: string;
  referralCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Check-in
 */
export interface EventCheckIn {
  id: string;
  tenantId: string;
  ticketSaleId: string;
  checkedInAt: Date;
  checkedInByActorId: string;
  checkedInByUserId: string | null;
  checkedOutAt: Date | null;
  checkedOutByActorId: string | null;
  checkedOutByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filtros para listar eventos
 */
export interface EventFilters {
  organizerActorId?: string;
  // F-EVENT-ORGANIZER-CONTINUITY: plural de organizerActorId — usuário pode representar N actors
  // (canRepresentActor é per-actor). Resolução da lista é responsabilidade do CALLER (server-side,
  // nunca actorId declarado pelo cliente); este filtro só aplica o IN já resolvido.
  organizerActorIds?: string[];
  locationActorId?: string;
  status?: EventStatus;
  startAtFrom?: Date | string;
  startAtTo?: Date | string;
  limit?: number;
  offset?: number;
  // 🔵 DECISION-0113 F6.5.6b — modo de visibilidade do caminho de descoberta. Default undefined → callers
  // internos (ex.: my-orders) inalterados (sem piso). Só GET /events define o modo:
  //  · 'public_discovery'   (B1) → piso: visibility='public' AND status IN ('published','active'); cliente estreita.
  //  · 'organizer_dashboard'(B2) → SEM piso, mas EXIGE organizerActorId (fail-closed) → o organizer representável
  //                                 vê os PRÓPRIOS draft/private/unlisted/group/followers; cliente estreita.
  visibilityMode?: 'public_discovery' | 'organizer_dashboard';
  // narrowing opcional do cliente por visibility (só estreita; no piso público o servidor já força 'public').
  visibility?: string;
  // 🔵 F6.5.6b-B3: userId do CALLER (derivado de req.user, NUNCA actorId declarado) — usado só no
  // public_discovery para abrir 'group' aos eventos de grupos onde o caller é membro (membership Actor-first em group_actor_memberships — cutover D9.2-B/DECISION-0188).
  discoveryUserId?: string;

  // ── 2026-08-04 · F-EVENT-DISCOVERY-FILTERS ────────────────────────────────────────────────
  // Clayton, sobre a vitrine: *"falta ferramentas de filtro, categorização, ver somente shows, ou
  // eventos, ou demais tipos de eventos, ver por data, preço, gênero"*.
  // 🔴 Todos ESTREITAM, nunca ampliam: aplicam-se DEPOIS do piso de visibilidade acima. Um filtro
  // não pode revelar evento que o piso esconde — por isso entram como AND, nunca como OR.
  // O VOCABULÁRIO destes filtros é governado e servido por GET /events/taxonomy (23 formatos em
  // `event_format_concepts`, 9 categorias com CHECK físico) — o cliente NUNCA enumera.
  /** slug do formato governado (show, festa, feira, reuniao…). Resolvido para concept_id no repo. */
  formatSlug?: string;
  /** facet de categoria (social, cultural, gastronomico…) — múltipla por evento em event_category_facets. */
  categoryKey?: string;
  /** true = só gratuitos (ticket_price_cents nulo ou 0). */
  onlyFree?: boolean;
  /** teto de preço em CENTAVOS (inteiro) — inclui os gratuitos, que são "até qualquer preço". */
  maxPriceCents?: number;
  /** concept_id de tema/gênero governado (event_theme_links) — ex.: rock, samba. */
  themeConceptId?: string;
}







