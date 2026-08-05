// backend/src/modules/events/events-sprint76.routes.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eventRepository } from './event.repository';
import { parseInstantQueryParam, assertInstantRangeCoherent } from '@core/http/query-instant';
import { ticketService } from './ticket.service';
import { checkInService } from './checkin.service';
import { eventTicketRepository } from './event-ticket.repository';
import { eventSectorService } from './event-sector.service';
import type {
  CreateEventInput,
  CreateEventTicketInput,
  ReserveTicketInput,
} from './event.types';
import type { UpdateEventTicketInput } from './event-ticket.repository';
import type { CreateEventSectorInput } from './event-sector.repository';

/**
 * 🔒 F-EVENT-TICKETING-CONVERGENCE (Fatia 1) — autoridade de CATÁLOGO de ingresso: o actor DONO
 * do evento (event.organizerActorId, server-resolved) precisa da CHAVE EXATA (create_events para
 * criar tipo novo; manage_events para editar tipo existente) — nunca representação isolada
 * (DECISION-0189A §3) nem o hint client-declarado (DECISION-0113). Espelha `userCanActOnActor` de
 * core/events/event.routes.ts (mesmo predicado; duplicado localmente porque aquele helper é
 * privado ao módulo core/events e este arquivo vive em modules/events).
 */
async function userCanActOnEventOwner(
  tenantId: string,
  userId: string | undefined,
  eventOwnerActorId: string | undefined,
  permissionKey: 'create_events' | 'manage_events'
): Promise<boolean> {
  if (!userId || !eventOwnerActorId) return false;
  const { authorizationService } = await import('@core/authorization/authorization.service');
  try {
    if ((await authorizationService.canActAs(tenantId, userId, eventOwnerActorId, permissionKey)).allowed) {
      return true;
    }
    // Evento de GRUPO: sem chave de governança de grupo (fora do escopo desta campanha) — mantém
    // o comportamento anterior (dono representa), mesma exceção do precedente em core/events.
    const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actor = await socialPortsRegistry.getActorRepository().findById(tenantId, eventOwnerActorId);
    if (actor && (actor as { group_id?: string | null }).group_id) {
      return await authorizationService.canRepresentActor(tenantId, userId, eventOwnerActorId);
    }
    return false;
  } catch {
    return false;
  }
}

/** Mesma auditoria que o wrapper sprint76 removido (create + audit). */
async function recordSprint76EventAudit(
  tenantId: string,
  data: {
    eventType: string;
    eventId: string;
    createdByActorId?: string;
    createdByUserId?: string | null;
    publishedByActorId?: string;
    publishedByUserId?: string | null;
    cancelledByActorId?: string;
    cancelledByUserId?: string | null;
    cancellationReason?: string | null;
  }
): Promise<void> {
  try {
    const { auditService } = await import('@core/audit/audit.service');
    await auditService.record(tenantId, {
      event_type: data.eventType,
      severity: 'WARNING',
      actor_id: data.createdByActorId || data.publishedByActorId || data.cancelledByActorId || undefined,
      actor_type: 'user',
      source: 'cultural_event_checkin',
      context: {
        event_id: data.eventId,
        created_by_user_id: data.createdByUserId,
        published_by_actor_id: data.publishedByActorId,
        published_by_user_id: data.publishedByUserId,
        cancelled_by_actor_id: data.cancelledByActorId,
        cancelled_by_user_id: data.cancelledByUserId,
        cancellation_reason: data.cancellationReason,
      },
    });
  } catch (error) {
    console.warn('[Event] Erro ao registrar auditoria:', error);
  }
}

const eventsSprint76Routes = async (fastify: FastifyInstance) => {
  // ============================================================
  // EVENTOS
  // ============================================================

  /**
   * POST /events
   * Cria novo evento
   */
  fastify.post<{ Body: CreateEventInput }>('/events', async (req, reply) => {
    // 🔴 A1c (EVENT-ENGINE-COMPLETION, §2/§4.8): WRITER ÚNICO. Rota legada W3 (sprint76 POST /api/events/
    // events → eventRepository.createEvent, INSERT INTO events paralelo; órfã sem FE) CONTIDA: 501 honesto
    // como PRIMEIRA instrução, ANTES do writer. Criação canônica = POST /api/events/v2/create (guided flow).
    // Corpo original abaixo (dead-code documentado).
    return reply.status(501).send({ error: 'EVENT_LEGACY_WRITER_CONVERGED', code: 'EVENT_LEGACY_WRITER_CONVERGED', message: 'Rota legada de criação de evento contida — use POST /api/events/v2/create (guided flow format-first).' });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    // 🔴 F-CAMADA-1-GATE-ACTIONCTX (DECISION-0113): actionContext.actorId é HINT cliente-declarado, NÃO autoridade.
    // O caller autenticado deve poder representar o actor declarado, senão forja authorship em nome de outro.
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    if (!(await authorizationService.canRepresentActor(tenantId, userId, actionContext.actorId))) {
      return reply.status(403).send({ error: 'ACTOR_REPRESENTATION_DENIED', code: 'ACTOR_REPRESENTATION_DENIED' });
    }

    // Converter datas se necessário
    const body = req.body as any;
    if (body.startAt) {
      body.startAt = new Date(body.startAt);
    }
    if (body.endAt) {
      body.endAt = new Date(body.endAt);
    }

    const event = await eventRepository.createEvent(tenantId, {
      organizerActorId: body.organizerActorId,
      title: body.title,
      description: body.description || null,
      locationActorId: body.locationActorId || null,
      startAt: body.startAt,
      endAt: body.endAt,
      createdByActorId: actionContext.actorId,
      createdByUserId: userId,
      metadata: body.metadata || {},
    });

    await recordSprint76EventAudit(tenantId, {
      eventType: 'EVENT_CREATED',
      eventId: event.id,
      createdByActorId: actionContext.actorId,
      createdByUserId: userId,
    });

    return reply.status(201).send(event);
  });

  /**
   * POST /events/:id/publish
   * Publica evento
   * 
   * 🔴 ROTA REMOVIDA - DUPLICADA
   * Esta rota está duplicada com:
   * - backend/src/core/events/event.routes.ts (linha 391): POST /api/events/:id/publish (v1)
   * - backend/src/core/events/event.routes.ts (linha 1019): POST /api/events/:id/v2/publish (v2)
   * 
   * Use uma das rotas canônicas acima.
   */
  // fastify.post<{ Params: { id: string } }>('/events/:id/publish', async (req, reply) => {
  //   const tenantId = req.tenant!.id;
  //   const actionContext = (req as any).actionContext;

  //   if (!actionContext?.actorId) {
  //     return reply.status(400).send({ error: 'actorId é obrigatório' });
  //   }

  //   const event = await eventService.publishEvent(
  //     tenantId,
  //     req.params.id,
  //     actionContext.actorId,
  //     actionContext.actorId
  //   );

  //   return reply.send(event);
  // });

  /**
   * GET /events
   * Lista eventos
   */
  fastify.get<{
    Querystring: {
      organizerActorId?: string;
      locationActorId?: string;
      status?: string;
      visibility?: string;
      startAtFrom?: string;
      startAtTo?: string;
      limit?: number;
      offset?: number;
      // F-EVENT-DISCOVERY-FILTERS (2026-08-04) — só ESTREITAM o piso de visibilidade.
      formatSlug?: string;
      categoryKey?: string;
      onlyFree?: string;
      maxPriceCents?: string;
      themeConceptId?: string;
    };
  }>('/events', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    // 🔵 DECISION-0113 F6.5.6b — modo de visibilidade do GET /events:
    //  · sem organizerActorId                          → public_discovery (piso B1).
    //  · organizerActorId + caller NÃO representável    → public_discovery DAQUELE organizer (NÃO 403 — vitrine).
    //  · organizerActorId + caller representável         → organizer_dashboard (vê os próprios não-públicos).
    // O cliente estreita; o servidor define o piso. group/followers/unlisted globais e canal-5 = B3/B4/canal-5.
    // userId do caller (derivado de req.user — NUNCA de actorId declarado). Usado p/ decidir representação
    // (organizer dashboard) E p/ abrir 'group' na discovery (B3; membership Actor-first em group_actor_memberships — cutover D9.2-B/DECISION-0188).
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const filters: any = {
      visibilityMode: 'public_discovery' as 'public_discovery' | 'organizer_dashboard',
      discoveryUserId: userId,
    };
    if (req.query.organizerActorId) {
      filters.organizerActorId = req.query.organizerActorId;
      if (userId) {
        let canRepresent = false;
        try {
          const { authorizationService } = await import('@core/authorization/authorization.service');
          canRepresent = await authorizationService.canRepresentActor(tenantId, userId, req.query.organizerActorId);
        } catch { canRepresent = false; }
        if (canRepresent) {
          filters.visibilityMode = 'organizer_dashboard';
        }
      }
    }
    if (req.query.locationActorId) {
      filters.locationActorId = req.query.locationActorId;
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.visibility) {
      filters.visibility = req.query.visibility;
    }
    // ── 2026-08-04 · F-EVENT-DISCOVERY-SPECIFIC-DATE ────────────────────────────────────────
    // 🔴 Isto era `new Date(req.query.startAtFrom)` cru. Medido com curl no servidor vivo antes
    // de trocar: `?startAtFrom=lixo` devolvia **HTTP 500** com o erro do Postgres vazado
    // (`22007 sintaxe de entrada é inválida para tipo timestamp with time zone: "0NaN-NaN-..."`).
    // `Invalid Date` satisfaz o tipo `Date` do TypeScript, então atravessou rota, service e
    // repositório sem um aviso — e só explodiu dentro do driver. Ver `@core/http/query-instant`.
    if (req.query.startAtFrom !== undefined) {
      const r = parseInstantQueryParam(req.query.startAtFrom, 'startAtFrom');
      if (!r.ok) return reply.status(400).send({ error: r.message, code: r.code });
      filters.startAtFrom = r.value;
    }
    if (req.query.startAtTo !== undefined) {
      const r = parseInstantQueryParam(req.query.startAtTo, 'startAtTo');
      if (!r.ok) return reply.status(400).send({ error: r.message, code: r.code });
      filters.startAtTo = r.value;
    }
    // O intervalo invertido não dá erro em lugar nenhum: gera `>= X AND <= Y` com X > Y, SQL
    // válido, zero linhas, 200. É a metade MUDA do mesmo defeito, e a que ninguém reporta.
    const intervaloIncoerente = assertInstantRangeCoherent(
      filters.startAtFrom, filters.startAtTo, 'startAtFrom', 'startAtTo'
    );
    if (intervaloIncoerente) {
      return reply.status(400).send({ error: intervaloIncoerente, code: 'QUERY_INSTANT_RANGE_INVERTED' });
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    // ── F-EVENT-DISCOVERY-FILTERS (2026-08-04) ──────────────────────────────────────────────
    // 🔴 Entrada de usuário NUNCA entra como `as any` no filtro: cada valor é COMPOSTO a partir do
    // vocabulário GOVERNADO (o mesmo que GET /events/taxonomy serve) e valor fora dele vira 400,
    // não 500 e não filtro silenciosamente ignorado. Ignorar em silêncio seria pior: o usuário
    // pediria "só shows" e receberia tudo, achando que viu tudo o que há.
    if (req.query.formatSlug) {
      const slug = String(req.query.formatSlug);
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const ok = await runQueriesWithTenant<{ n: string }>(
        tenantId,
        `SELECT count(*)::text n FROM event_format_concepts efc
           JOIN concepts c ON c.concept_id = efc.concept_id
          WHERE c.slug = $1 AND efc.enabled = true`,
        [slug]
      );
      if (Number(ok[0]?.n ?? 0) === 0) {
        return reply.status(400).send({ error: 'Formato desconhecido', code: 'EVENT_FORMAT_UNKNOWN', formatSlug: slug });
      }
      filters.formatSlug = slug;
    }
    if (req.query.categoryKey) {
      const { EVENT_CATEGORIES } = await import('@core/events/event.types');
      const key = String(req.query.categoryKey);
      if (!(EVENT_CATEGORIES as readonly string[]).includes(key)) {
        return reply.status(400).send({ error: 'Categoria desconhecida', code: 'EVENT_CATEGORY_UNKNOWN', categoryKey: key });
      }
      filters.categoryKey = key;
    }
    if (req.query.themeConceptId) {
      filters.themeConceptId = String(req.query.themeConceptId);
    }
    if (String(req.query.onlyFree ?? '').toLowerCase() === 'true') {
      filters.onlyFree = true;
    } else if (req.query.maxPriceCents) {
      const n = Number(req.query.maxPriceCents);
      if (!Number.isFinite(n) || n < 0) {
        return reply.status(400).send({ error: 'maxPriceCents inválido', code: 'EVENT_MAX_PRICE_INVALID' });
      }
      filters.maxPriceCents = Math.trunc(n);
    }

    const events = await eventRepository.listEvents(tenantId, filters);

    // ⚠️ Este campo se chamava `totalCents` e é uma CONTAGEM DE EVENTOS, não dinheiro. O sufixo
    // `_cents` é reservado a valor monetário (07_NOMENCLATURA §4.7) — ler isso como centavos levaria
    // alguém a exibir "R$ 3,00" para 3 eventos. Renomeado ao ser encontrado; zero consumidor no
    // repositório (grep), então a troca é segura.
    return reply.send({ events, total: events.length });
  });

  /**
   * GET /events/:id
   * Busca evento por ID
   */
  fastify.get<{ Params: { id: string } }>('/events/:id', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const event = await eventRepository.getEventById(tenantId, req.params.id);

    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-A: acesso por ID herda o modelo de visibility da discovery (B1–B4).
    // Deny-first → 404 não-leak (não confirma existência) para evento que o caller não pode ver.
    const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, req.params.id, callerUserId))) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    return reply.send(event);
  });

  // ============================================================
  // INGRESSOS
  // ============================================================

  /**
   * POST /events/:id/tickets
   * Cria tipo de ingresso para evento
   */
  fastify.post<{
    Params: { id: string };
    Body: CreateEventTicketInput;
  }>('/events/:id/tickets', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    // 🔴 F-EVENT-TICKETING-CONVERGENCE (Fatia 1): autoridade é sobre o DONO DO EVENTO
    // (event.organizerActorId, server-resolved), NÃO sobre actionContext.actorId (HINT, DECISION-0113).
    // create_events = chave exata para criar tipo novo (DECISION-0189A §3).
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'create_events'))) {
      return reply.status(403).send({ error: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED', code: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' });
    }

    const ticket = await ticketService.createTicketType(
      tenantId,
      req.params.id,
      req.body,
      event.organizerActorId,
      userId
    );

    return reply.status(201).send(ticket);
  });

  /**
   * PATCH /events/:id/tickets/:ticketId
   * Edita tipo de ingresso (preço/quantidade/moeda/metadata) — catálogo (Fatia 1). Bank-free
   * (price_cents = valor ANUNCIADO, nunca cobrança). manage_events = chave exata para editar tipo
   * já existente (DECISION-0189A §3), espelhando PATCH /events/:id em core/events/event.routes.ts.
   */
  fastify.patch<{
    Params: { id: string; ticketId: string };
    Body: UpdateEventTicketInput;
  }>('/events/:id/tickets/:ticketId', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'manage_events'))) {
      return reply.status(403).send({ error: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED', code: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' });
    }

    // Anti-IDOR: o tipo de ingresso deve pertencer ao evento declarado no path.
    const existingTicket = await eventTicketRepository.getTicketById(tenantId, req.params.ticketId);
    if (!existingTicket || existingTicket.eventId !== req.params.id) {
      return reply.status(404).send({ error: 'Tipo de ingresso não encontrado neste evento' });
    }

    try {
      const updated = await ticketService.updateTicketType(tenantId, req.params.ticketId, req.body);
      return reply.send(updated);
    } catch (error) {
      return reply.status(400).send({
        error: 'Erro ao atualizar tipo de ingresso',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // SETORES (SLICE S3) — setor SELF-CONTAINED com inteira/meia (piso legal 40%)
  // ============================================================

  /**
   * POST /events/:id/sectors
   * Cria SETOR self-contained (pool compartilhado, preço inteira + meia legalmente pisada — meia =
   * METADE EXATA da inteira, Lei 12.933/2013). Bank-free: preços são valores DECLARADOS de catálogo
   * (Δbank=0). Autoridade = chave EXATA create_events sobre o DONO DO EVENTO (event.organizerActorId,
   * server-resolved) — espelha a rota de ingresso; validate-before-mutate no service (validação de
   * runtime do corpo + piso legal da meia + meia=metade exata + reconciliação ATÔMICA — transação +
   * advisory lock — com max_attendees).
   */
  fastify.post<{
    Params: { id: string };
    Body: CreateEventSectorInput;
  }>('/events/:id/sectors', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'create_events'))) {
      return reply.status(403).send({ error: 'EVENT_SECTOR_ACTOR_NOT_AUTHORIZED', code: 'EVENT_SECTOR_ACTOR_NOT_AUTHORIZED' });
    }

    try {
      const sector = await eventSectorService.createSector(tenantId, req.params.id, req.body);
      return reply.status(201).send(sector);
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode ?? 400;
      const code = (error as { code?: string })?.code;
      return reply.status(statusCode).send({
        error: error instanceof Error ? error.message : String(error),
        ...(code ? { code } : {}),
      });
    }
  });

  /**
   * GET /events/:id/sectors
   * Lista os setores do evento (catálogo DECLARADO). VITRINE do comprador: evento PUBLICADO/público
   * mostra os preços; DRAFT/privado só a quem pode ver. Espelha o irmão GET /events/:id — canViewEvent
   * deny-first → 404 não-leak (não vaza preço/capacidade/cota de eventos DRAFT/privados). tenant-scoped.
   */
  fastify.get<{
    Params: { id: string };
  }>('/events/:id/sectors', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-A: visibilidade herdada do irmão GET /events/:id (mesmo helper,
    // mesmo padrão deny-first → 404 não-leak). NÃO é owner-only (quebraria a vitrine do comprador).
    const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, req.params.id, callerUserId))) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    const sectors = await eventSectorService.listSectors(tenantId, req.params.id);
    return reply.send(sectors);
  });

  /**
   * PATCH /events/:id/sectors/:sectorId · DELETE /events/:id/sectors/:sectorId
   * F-EVENT-SECTOR-EDIT (2026-08-03, pedido de Clayton: "lápis de editar e lixeira"). Sem isto, uma
   * área errada era definitiva — e com a capacidade cheia o organizador ficava sem saída nenhuma.
   *
   * 🔴 O GATE DE OWNERSHIP É REPETIDO AQUI DE PROPÓSITO. A nota E7 em event-sector.service.ts avisa:
   * "qualquer wiring FUTURO de rota PRECISA repetir o gate (userCanActOnEventOwner sobre
   * event.organizerActorId) NA ROTA — este service NÃO reverifica autoridade". Espelha o padrão já
   * SELADO do POST /events/:id/sectors, incluindo o 404 antes do 403 (não vaza existência).
   * A reconciliação SUM(capacity) <= max_attendees continua no repository, sob advisory lock.
   */
  const assertSectorOwner = async (
    req: FastifyRequest<{ Params: { id: string; sectorId: string } }>,
    reply: FastifyReply
  ): Promise<{ tenantId: string } | null> => {
    if (!req.tenant?.id) {
      await reply.status(400).send({ error: 'Tenant é obrigatório' });
      return null;
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.userId;
    if (!userId) {
      await reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return null;
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      await reply.status(404).send({ error: 'Evento não encontrado' });
      return null;
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'create_events'))) {
      await reply.status(403).send({ error: 'EVENT_SECTOR_ACTOR_NOT_AUTHORIZED', code: 'EVENT_SECTOR_ACTOR_NOT_AUTHORIZED' });
      return null;
    }
    // A área tem de ser DESTE evento: sem isto, o id de um setor de outro evento do mesmo tenant
    // passaria pelo gate do evento A e editaria o evento B.
    const sector = await eventSectorService.getSector(tenantId, req.params.sectorId);
    if (!sector || sector.eventId !== req.params.id) {
      await reply.status(404).send({ error: 'Setor não encontrado neste evento' });
      return null;
    }
    return { tenantId };
  };

  fastify.patch<{
    Params: { id: string; sectorId: string };
    Body: Partial<CreateEventSectorInput>;
  }>('/events/:id/sectors/:sectorId', async (req, reply) => {
    const ctx = await assertSectorOwner(req, reply);
    if (!ctx) return reply;
    try {
      const sector = await eventSectorService.updateSector(ctx.tenantId, req.params.sectorId, req.body);
      return reply.send(sector);
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode ?? 400;
      const code = (error as { code?: string })?.code;
      return reply.status(statusCode).send({
        error: error instanceof Error ? error.message : String(error),
        ...(code ? { code } : {}),
      });
    }
  });

  fastify.delete<{
    Params: { id: string; sectorId: string };
  }>('/events/:id/sectors/:sectorId', async (req, reply) => {
    const ctx = await assertSectorOwner(req, reply);
    if (!ctx) return reply;
    const removed = await eventSectorService.deleteSector(ctx.tenantId, req.params.sectorId);
    if (!removed) return reply.status(404).send({ error: 'Setor não encontrado neste evento' });
    return reply.status(200).send({ ok: true });
  });

  /**
   * POST /tickets/:id/reserve
   * Reserva ingresso (cria PaymentIntent)
   */
  fastify.post<{
    Params: { id: string };
    Body: ReserveTicketInput;
  }>('/tickets/:id/reserve', async (req, reply) => {
    // 🔴 F-EVENT-TICKETING-CONVERGENCE (Fatia 1, ADDENDUM) — CONTENÇÃO HONESTA. reserveTicket cria
    // ORDER (orderService.createOrder/submitOrder) e ENTÃO chama ticketSaleRepository.createSale,
    // que mira colunas de ticket_sales que NUNCA existiram no schema vivo (event_ticket_id/
    // payment_intent_id/...) — reproduzido: a chamada REAL cria um `orders` órfão e só então
    // estoura 500 em submitOrder/createSale. ticket_sales é convergido em fatia PRÓPRIA (Fatia 2,
    // dinheiro/ratificação-gated). Espelha a forma de checkout-ticket.service.purchaseTicket: erro
    // HONESTO ANTES de qualquer escrita — nenhum order/paymentIntent/ticket_sales é tocado enquanto
    // esta contenção estiver ativa. Corpo original preservado ABAIXO, intocado, para a Fatia 2.
    return reply.status(501).send({
      error: 'TICKET_PURCHASE_DEFERRED_FATIA2',
      code: 'TICKET_PURCHASE_DEFERRED_FATIA2',
      message: 'Compra de ingresso será habilitada na Fatia 2 (F-EVENT-TICKETING-CONVERGENCE) — ' +
        'ticket_sales ainda não convergido ao schema vivo. Nenhuma escrita (order/paymentIntent/ticket_sales) foi realizada.',
    });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    // 🔴 F-CAMADA-1-GATE-ACTIONCTX (DECISION-0113): actionContext.actorId é HINT, NÃO autoridade.
    // Reserva cria PaymentIntent (money-adjacent) — caller deve poder representar o actor antes de qualquer trilho de dinheiro.
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    if (!(await authorizationService.canRepresentActor(tenantId, userId, actionContext.actorId))) {
      return reply.status(403).send({ error: 'ACTOR_REPRESENTATION_DENIED', code: 'ACTOR_REPRESENTATION_DENIED' });
    }

    const result = await ticketService.reserveTicket(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      userId
    );

    return reply.status(201).send(result);
  });

  /**
   * POST /tickets/:id/pay
   * Confirma pagamento de ingresso
   */
  fastify.post<{ Params: { id: string } }>('/tickets/:id/pay', async (req, reply) => {
    // 🔴 F-EVENT-TICKETING-CONVERGENCE (Fatia 1, ADDENDUM) — CONTENÇÃO HONESTA. confirmTicketPayment
    // chama ticketSaleRepository.getSaleById primeiro, que mira colunas de ticket_sales inexistentes
    // no schema vivo — reproduzido: estoura 500 (`coluna "event_ticket_id" não existe`) antes de
    // qualquer escrita (falha de LEITURA, sem órfãos aqui). ticket_sales é convergido em fatia
    // PRÓPRIA (Fatia 2, dinheiro/ratificação-gated). Espelha checkout-ticket.service.purchaseTicket:
    // erro HONESTO em vez do 500 cru de coluna inexistente. Corpo original preservado ABAIXO,
    // intocado, para a Fatia 2.
    return reply.status(501).send({
      error: 'TICKET_PURCHASE_DEFERRED_FATIA2',
      code: 'TICKET_PURCHASE_DEFERRED_FATIA2',
      message: 'Confirmação de pagamento de ingresso será habilitada na Fatia 2 (F-EVENT-TICKETING-CONVERGENCE) — ' +
        'ticket_sales ainda não convergido ao schema vivo. Nenhuma escrita foi realizada.',
    });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const ticketSale = await ticketService.confirmTicketPayment(tenantId, req.params.id);

    return reply.send(ticketSale);
  });

  /**
   * POST /tickets/:id/cancel
   * Cancela ingresso reservado
   */
  fastify.post<{
    Params: { id: string };
    Body: { cancellationReason?: string };
  }>('/tickets/:id/cancel', async (req, reply) => {
    // 🔴 F-EVENT-TICKETING-CONVERGENCE (CONTENÇÃO das rotas mortas) — cancelTicket chama
    // ticketSaleRepository.getSaleById primeiro, que mira colunas de ticket_sales inexistentes no
    // schema vivo — reproduzido: 500 (`coluna "event_ticket_id" não existe`) na PRIMEIRA leitura,
    // ZERO escrita. O ciclo de venda de ingresso (ticket_sales) é convergido em fatia PRÓPRIA.
    // Fecha DT-EVENTS-SPRINT76-ACTOR-HINT-AUTHORSHIP-FORGERY por CONTENÇÃO: rota deferida não escreve
    // → não forja autoria. Espelha o addendum-1 (/reserve, /pay) e checkout-ticket.service. Corpo
    // original preservado ABAIXO, intocado, para a fatia própria.
    return reply.status(501).send({
      error: 'TICKET_CANCEL_DEFERRED',
      code: 'TICKET_CANCEL_DEFERRED',
      message: 'Cancelamento de ingresso será habilitado quando o ciclo de venda (ticket_sales) for ' +
        'convergido ao schema vivo em fatia própria. Nenhuma escrita foi realizada.',
    });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const ticketSale = await ticketService.cancelTicket(
      tenantId,
      req.params.id,
      actionContext.actorId,
      actionContext.actorId,
      req.body.cancellationReason
    );

    return reply.send(ticketSale);
  });

  // ============================================================
  // CHECK-IN / CHECK-OUT
  // ============================================================

  /**
   * POST /checkin/:ticketSaleId
   * Realiza check-in
   */
  fastify.post<{ Params: { ticketSaleId: string } }>('/checkin/:ticketSaleId', async (req, reply) => {
    // 🔴 F-EVENT-TICKETING-CONVERGENCE (CONTENÇÃO das rotas mortas) — checkInService.checkIn chama
    // ticketSaleRepository.getSaleById primeiro (coluna-fantasma) — reproduzido: 500 na PRIMEIRA
    // leitura, ZERO escrita. Check-in converge na Fatia 4, DEPOIS da compra (Fatia 2) — ticket_sales
    // ainda não convergido. Fecha DT-...-AUTHORSHIP-FORGERY por contenção (rota deferida não escreve).
    // Corpo original preservado ABAIXO, intocado, para a Fatia 4.
    return reply.status(501).send({
      error: 'TICKET_CHECKIN_DEFERRED_FATIA4',
      code: 'TICKET_CHECKIN_DEFERRED_FATIA4',
      message: 'Check-in de ingresso será habilitado na Fatia 4 (após a compra/Fatia 2) — ticket_sales ' +
        'ainda não convergido ao schema vivo. Nenhuma escrita foi realizada.',
    });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const checkIn = await checkInService.checkIn(
      tenantId,
      req.params.ticketSaleId,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(checkIn);
  });

  /**
   * POST /checkout/:ticketSaleId
   * Realiza check-out
   */
  fastify.post<{ Params: { ticketSaleId: string } }>('/checkout/:ticketSaleId', async (req, reply) => {
    // 🔴 F-EVENT-TICKETING-CONVERGENCE (CONTENÇÃO das rotas mortas) — checkInService.checkOut chama
    // eventCheckInRepository.getCheckInByTicketSale primeiro (coluna-fantasma ticket_sale_id em
    // event_checkins) — reproduzido: 500 na PRIMEIRA leitura, ZERO escrita. Mesmo modelo do check-in:
    // converge na Fatia 4. Fecha DT-...-AUTHORSHIP-FORGERY por contenção. Corpo original preservado
    // ABAIXO, intocado, para a Fatia 4.
    return reply.status(501).send({
      error: 'TICKET_CHECKIN_DEFERRED_FATIA4',
      code: 'TICKET_CHECKIN_DEFERRED_FATIA4',
      message: 'Check-out de ingresso será habilitado na Fatia 4 (após a compra/Fatia 2) — ticket_sales/' +
        'event_checkins ainda não convergidos ao schema vivo. Nenhuma escrita foi realizada.',
    });

    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const checkOut = await checkInService.checkOut(
      tenantId,
      req.params.ticketSaleId,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.send(checkOut);
  });
};

export default eventsSprint76Routes;






