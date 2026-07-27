// src/core/events/event.routes.ts
// Rotas REST para eventos conforme CONTRATO DE EVENTOS v1
// FASE 5: INTEGRAÇÃO CONTROLADA

import { randomUUID } from 'crypto';
import { FastifyPluginAsync, type FastifyReply, type FastifyRequest } from 'fastify';
import { eventService } from './event.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import { describePostgresSchemaError } from '@core/errors/postgres-schema-error';
import { buildCanonicalHttpErrorPayload } from '@core/http/canonical-http-error';
import { runQueryWithTenant, getClientWithTenant } from '@core/database/pool';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from './event-outbox.repository';
import { eventRateLimitService } from './event-rate-limit.service';
import type {
  CreateEventInput,
  UpdateEventInput,
  EventType,
  EventVisibility,
  DeclareEventInput,
} from './event.types';
import { operationalCommitmentsService } from './operational-commitments.service';
import type {
  CreateOperationalCommitmentInput,
  CheckInInput,
  CheckOutInput,
  MarkFailedInput,
} from './operational-commitments.types';
import { eventCreationOrchestrator } from './event-creation.orchestrator';
import type {
  CreateDraftInput,
  SetTimeWindowsInput,
  SetOperationalCommitmentsInput,
} from './event-creation.orchestrator';
import { eventEconomicPhaseService } from './event-economic-phase.service';
import type { AdvanceToEconomicPhaseInput } from './event-economic-phase.service';
import { eventCustodyService } from './event-custody.service';
import type { CreateCustodyInput } from './event-custody.service';
import { eventPaymentPreparedService } from './event-payment-prepared.service';
import type { AuthorizePaymentInput } from './event-payment-prepared.service';
import { eventEconomyService } from './event-economy.service';
import { eventSplitDeclarativeService } from './event-split-declarative.service';
import { eventRefundChargebackService } from './event-refund-chargeback.service';
import { eventPaymentExecutionService } from './event-payment-execution.service';
import {
  IdempotencyMismatchError,
  IDEMPOTENCY_MISMATCH_HTTP_MESSAGE,
} from '@core/events/idempotency-tracker';
import type { CalculateSplitInput } from './event-economy.types';
import type { RequestRefundInput, InitiateChargebackInput } from './event-payment.types';

function eventRoutesReqId(req: FastifyRequest): string {
  const raw = (req as { requestId?: string; id?: string }).requestId ?? req.id;
  return typeof raw === 'string' && raw.trim() !== '' ? raw : randomUUID();
}

function sendEventHttpError(
  reply: FastifyReply,
  req: FastifyRequest,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return reply.status(statusCode).send(
    buildCanonicalHttpErrorPayload(
      code,
      message,
      eventRoutesReqId(req),
      details && Object.keys(details).length > 0 ? { details } : undefined
    )
  );
}

/**
 * Body em snake_case (contrato externo da API) para criação de evento.
 * Converter para CreateEventInput (camelCase) antes de usar nos serviços.
 */
interface CreateEventBodyRaw {
  actor_id: string;
  actor_type: 'user' | 'page';
  event_type: string;
  event_subtype?: string | null;
  title: string;
  description?: string | null;
  datetime_start?: string | null;
  datetime_end?: string | null;
  visibility?: string;
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  metadata?: Record<string, unknown> | null;
  // DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC: opcional; omitido preserva o DEFAULT 'UTC' do banco.
  timezone?: string | null;
}

function toCreateEventInput(body: CreateEventBodyRaw): CreateEventInput {
  return {
    actorId: body.actor_id,
    actorType: body.actor_type,
    eventType: body.event_type as EventType,
    eventSubtype: body.event_subtype ?? undefined,
    title: body.title,
    description: body.description ?? undefined,
    datetimeStart: body.datetime_start ?? undefined,
    datetimeEnd: body.datetime_end ?? undefined,
    visibility: body.visibility as EventVisibility | undefined,
    ticketPriceCents: body.ticket_price_cents ?? undefined,
    maxAttendees: body.max_attendees ?? undefined,
    metadata: body.metadata ?? undefined,
    timezone: body.timezone ?? undefined,
  };
}

/**
 * Body em snake_case para criar OperationalCommitment.
 */
interface CreateOperationalCommitmentBodyRaw {
  responsible_actor_id: string;
  responsible_actor_type: 'user' | 'page' | 'group' | 'channel';
  role: string;
  time_window_ref?: {
    start_datetime: string;
    end_datetime: string;
    timezone?: string | null;
  } | null;
}

function toCreateOperationalCommitmentInput(
  eventId: string,
  body: CreateOperationalCommitmentBodyRaw
): CreateOperationalCommitmentInput {
  return {
    eventId,
    responsibleActorId: body.responsible_actor_id,
    responsibleActorType: body.responsible_actor_type,
    role: body.role,
    timeWindowRef: body.time_window_ref
      ? {
          startDatetime: body.time_window_ref.start_datetime,
          endDatetime: body.time_window_ref.end_datetime,
          timezone: body.time_window_ref.timezone ?? undefined,
        }
      : undefined,
  };
}

/**
 * Body em snake_case para SetTimeWindows.
 */
interface SetTimeWindowsBodyRaw {
  desired_time_windows?: Array<{
    start_datetime: string;
    end_datetime: string;
    timezone?: string | null;
  }> | null;
  flexibility_level?: string | null;
  timezone?: string | null;
}

function toSetTimeWindowsInput(eventId: string, body: SetTimeWindowsBodyRaw): SetTimeWindowsInput {
  return {
    eventId,
    desiredTimeWindows: (body.desired_time_windows ?? []).map((w) => ({
      startDatetime: w.start_datetime,
      endDatetime: w.end_datetime,
      timezone: w.timezone ?? undefined,
    })),
    flexibilityLevel: (body.flexibility_level as 'strict' | 'flexible' | 'very_flexible') ?? undefined,
    timezone: body.timezone ?? undefined,
  };
}

/**
 * Helper: Obtém actor_id do usuário autenticado
 */
/**
 * Helper: Obtém actor do ActionContext
 * Conforme ACTIONCONTEXT_CONTRACT.md: ActionContext é SSOT
 */
// 🔴 V1 FIX (auditoria forense 2026-07-04, DT-AUTHORITY-REGUA-PELA-METADE): resolve o actor
// declarado E PROVA que o usuário autenticado o REPRESENTA (canRepresentActor, DECISION-0113) —
// fail-closed. Substitui o antigo `getAuthenticatedUserActor`, que só fazia `findById` (nome
// enganoso: "Authenticated" mas NÃO provava representação) → BOLA/IDOR no lifecycle de eventos:
// qualquer autenticado punha o actorId do dono em x-action-context e editava/cancelava/reprecificava
// evento alheio (o service só comparava event.actorId === actorId, ambos client-controlled). Agora
// TODO handler de mutação de evento passa por esta catraca antes de tocar o service.
async function resolveRepresentedActor(
  tenantId: string,
  userId: string | undefined,
  actorId: string
): Promise<{ actor_id: string; actor_type: 'user' }> {
  if (!userId) {
    throw new ForbiddenError('Autenticação obrigatória para representar o actor');
  }
  // PROVA de representação server-side (o único fato de autoridade; actorId declarado é HINT).
  const { authorizationService } = await import('@core/authorization/authorization.service');
  let represents = false;
  try {
    represents = await authorizationService.canRepresentActor(tenantId, userId, actorId);
  } catch {
    represents = false;
  }
  if (!represents) {
    throw new ForbiddenError('Usuário não representa o actor declarado (canRepresentActor)');
  }
  // Só então resolve a projeção do actor (existência garantida pela representabilidade, mas mantido
  // o findById para o actor_type canônico).
  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const actorRepository = socialPortsRegistry.getActorRepository();
  const actor = await actorRepository.findById(tenantId, actorId);

  if (!actor) {
    throw new NotFoundError('Actor não encontrado no tenant');
  }

  return {
    actor_id: actor.actor_id,
    actor_type: actor.actor_type as 'user',
  };
}

/**
 * 🔴 F-0113-EVENT-ACTOR-BODY-BINDING (DECISION-0113): actor_id/actor_type vindos do body (ou de
 * actionContext) são HINT — nunca autoridade. A autoridade exige que o utilizador AUTENTICADO
 * (`req.user.userId`) REPRESENTE o actor declarado, resolvido server-side por `canRepresentActor`
 * (ownership do actor 'user' · gestão da empresa do 'page' · dono do grupo · delegação ativa).
 * Fail-closed: sem userId/actorId ou sem representabilidade → false. Substitui o match fraco contra
 * `actionContext.actorId` (também client-declared).
 */
async function userRepresentsActor(
  tenantId: string,
  userId: string | undefined,
  actorId: string | undefined
): Promise<boolean> {
  if (!userId || !actorId) return false;
  const { authorizationService } = await import('@core/authorization/authorization.service');
  try {
    return await authorizationService.canRepresentActor(tenantId, userId, actorId);
  } catch {
    return false;
  }
}

/**
 * 🔴 F1/F2/F3 FIX (auditoria YALA 2026-07-04, DT-AUTHORITY-REGUA-PELA-METADE): handlers de mutação
 * que roteiam para services OUTROS que `eventService` (payment/revoke → eventPaymentPreparedService;
 * commitments/fail|check-in|check-out → operationalCommitmentsService) NÃO passavam pela catraca de
 * V1 (`resolveRepresentedActor` sobre actionContext) — a "régua pela metade" reaparecendo num
 * service com outro nome. Esta prova, fail-closed, que o utilizador autenticado REPRESENTA o dono do
 * EVENTO ao qual o objeto-alvo (autorização/commitment) pertence — o mesmo direito de autoridade que
 * o `authorize` já exige. Lança ForbiddenError/NotFoundError (mapear p/ 403/404 no handler).
 */
async function assertRepresentsEventOwner(
  tenantId: string,
  userId: string | undefined,
  eventId: string,
  exactKey?: 'manage_events' | 'manage_attendees'
): Promise<void> {
  if (!userId) {
    throw new ForbiddenError('Autenticação obrigatória para agir sobre o evento');
  }
  const event = await eventService.getEvent(tenantId, eventId);
  if (!event) {
    throw new NotFoundError('Evento não encontrado');
  }
  if (!(await userRepresentsActor(tenantId, userId, event.actorId))) {
    throw new ForbiddenError('Usuário não representa o dono do evento');
  }
  // 🔒 DECISION-0189A §3 (D4): representação NÃO é a decisão final — writers exigem a CHAVE
  // EXATA sobre o actor DONO do evento (canActAs: self · governança/delegação exata p/ empresa).
  if (exactKey && !(await userCanActOnActor(tenantId, userId, event.actorId, exactKey))) {
    throw new ForbiddenError(`Sem a permissão exata ${exactKey} sobre o dono do evento (DECISION-0189A)`);
  }
}

/**
 * 🔒 DECISION-0189A §2/§3 — DECISÃO FINAL por CHAVE EXATA (D3): canActAs(permissionKey) sobre o
 * actor-alvo resolvido server-side. Representação isolada NUNCA autoriza (D2). Fail-closed.
 */
async function userCanActOnActor(
  tenantId: string,
  userId: string | undefined,
  actorId: string | undefined,
  permissionKey: 'create_events' | 'manage_events' | 'manage_attendees' | 'publish_feed'
): Promise<boolean> {
  if (!userId || !actorId) return false;
  const { authorizationService } = await import('@core/authorization/authorization.service');
  try {
    if ((await authorizationService.canActAs(tenantId, userId, actorId, permissionKey)).allowed) {
      return true;
    }
    // CONTENÇÃO DE GRUPO (DECISION-0189A §3 — grupos FORA do escopo da campanha; DT-GROUP-*):
    // eventos de GRUPO nunca tiveram gate por chave (só representação do dono) e o registry de
    // grupos não carrega can_create_events — sem este desvio o gate NOVO regrediria o fluxo
    // legado de grupo. Para actor de GRUPO, mantém-se o comportamento anterior (dono representa).
    // Empresas e PF ficam SÓ com a chave exata acima.
    const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actor = await socialPortsRegistry.getActorRepository().findById(tenantId, actorId);
    if (actor && (actor as { group_id?: string | null }).group_id) {
      return await userRepresentsActor(tenantId, userId, actorId);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 🔒 DECISION-0189A §3 — gate exato de WRITER sobre evento EXISTENTE: carrega o evento
 * server-side, resolve o actor DONO e exige a chave exata. Uniforme: inexistente → NotFound;
 * sem chave → Forbidden (nunca aceita actorId do cliente como prova).
 */
async function assertEventExactAuthority(
  tenantId: string,
  userId: string | undefined,
  eventId: string,
  permissionKey: 'manage_events' | 'manage_attendees'
): Promise<void> {
  if (!userId) {
    throw new ForbiddenError('Autenticação obrigatória para agir sobre o evento');
  }
  const event = await eventService.getEvent(tenantId, eventId);
  if (!event) {
    throw new NotFoundError('Evento não encontrado');
  }
  if (!(await userCanActOnActor(tenantId, userId, event.actorId, permissionKey))) {
    throw new ForbiddenError(`Sem a permissão exata ${permissionKey} sobre o dono do evento (DECISION-0189A)`);
  }
}

const eventRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /events/audience-options — DECISION-0161 D2 (contrato server-driven de PLATEIA, padrão C1).
   * Devolve as plateias POSSÍVEIS do actor ativo (PF ≠ empresa), COMPOSTAS dos vocabulários
   * GOVERNADOS: events.visibility (macro, CHECK) + RELATIONSHIP_LABELS do typed-edge (refinamento).
   * A superfície (wizard/composer) PROJETA este contrato — proibido hardcodar plateia em TSX.
   * Gate: canRepresentActor (fail-closed 403) — o actor declarado é hint, nunca autoridade.
   */
  fastify.get('/audience-options', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const tenantId = req.tenant.id;
    const actorId = req.actionContext?.actorId;
    if (!actorId) {
      return reply.status(400).send({ ok: false, code: 'ACTION_CONTEXT_REQUIRED' });
    }
    let actor: { actor_id: string; actor_type: string };
    try {
      actor = await resolveRepresentedActor(
        req.tenant.id,
        req.user?.userId,
        actorId
      );
    } catch {
      return reply.status(403).send({ ok: false, code: 'ACTOR_NOT_REPRESENTABLE' });
    }
    // F-EVENT-AUDIENCE-SSOT-UNIFICATION (2026-07-08): espelha o TRANSVERSAL buildAudienceOptions —
    // fonte única (public/connections/only_me + refinamento por label). Evento deixou de ter vocabulário
    // paralelo (followers/private/group). Qualquer consumidor deste endpoint recebe o contrato canônico.
    const { buildAudienceOptions } = await import('@core/audience/audience-options');
    const options = buildAudienceOptions(actor.actor_type);
    return reply.send({ ok: true, data: { actorType: actor.actor_type, options } });
  });

  /**
   * GET /events/taxonomy — F-EVENT-CONCEPT-FIRST-MODEL. Contrato SERVER-DRIVEN da taxonomia (formatos/
   * categorias/location-modes/access-types). O frontend NUNCA enumera — só projeta isto.
   */
  fastify.get('/taxonomy', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const { eventTaxonomyService } = await import('./event-taxonomy.service');
    const formats = await eventTaxonomyService.listFormats(req.tenant.id);
    return reply.send({
      ok: true,
      data: {
        formats,
        categories: eventTaxonomyService.listCategories(),
        locationModes: eventTaxonomyService.listLocationModes(),
        accessTypes: eventTaxonomyService.listAccessTypes(),
      },
    });
  });

  /**
   * GET /events/themes/search?q= — busca de TEMA (CONCEPT livre). Composição formato × tema.
   */
  fastify.get<{ Querystring: { q?: string; limit?: string } }>('/themes/search', async (req: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>, reply: FastifyReply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const { eventTaxonomyService } = await import('./event-taxonomy.service');
    const results = await eventTaxonomyService.searchThemes(req.tenant.id, req.query.q ?? '', req.query.limit ? parseInt(req.query.limit, 10) : 20);
    return reply.send({ ok: true, data: { themes: results } });
  });

  /**
   * GET /events/:id/orchestration-suggestions — F-EVENT-ORCHESTRATION-PHASE-B. Necessidades operacionais
   * SUGERIDAS pelo TEMPLATE do formato do evento (event_orchestration_template_items por format_concept_id).
   * Read-only: NÃO cria event_operational_needs/demanda/RFQ/booking. Autoridade = dono do evento
   * (assertRepresentsEventOwner, fail-closed 403/404). Contrato em API_CONTRACT_GOVERNANCE.md §5.
   */
  fastify.get<{ Params: { id: string } }>('/:id/orchestration-suggestions', async (req, reply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const tenantId = req.tenant.id;
    await assertRepresentsEventOwner(tenantId, req.user?.userId, req.params.id);
    const { eventTaxonomyService } = await import('./event-taxonomy.service');
    const suggestions = await eventTaxonomyService.listOrchestrationSuggestions(tenantId, req.params.id);
    return reply.status(200).send({ suggestions });
  });

  /**
   * GET/POST/DELETE /events/:id/operational-needs — F-EVENT-ORCHESTRATION-PHASE-B-WRITE. Instância governada
   * da seleção do organizador (event_operational_needs). Organizer-gated (assertRepresentsEventOwner).
   * FACTUAL: NÃO dispara demanda/RFQ/booking/agenda/Bank. POST só aceita need ∈ sugestões do formato (422 fora).
   */
  fastify.get<{ Params: { id: string } }>('/:id/operational-needs', async (req, reply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const tenantId = req.tenant.id;
    await assertRepresentsEventOwner(tenantId, req.user?.userId, req.params.id);
    const { eventOperationalNeedsService } = await import('./event-operational-needs.service');
    const needs = await eventOperationalNeedsService.list(tenantId, req.params.id);
    return reply.status(200).send({ needs });
  });

  fastify.post<{ Params: { id: string }; Body: { needConceptId?: string } }>('/:id/operational-needs', async (req, reply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const tenantId = req.tenant.id;
    await assertRepresentsEventOwner(tenantId, req.user?.userId, req.params.id, 'manage_events');
    const needConceptId = req.body?.needConceptId;
    if (!needConceptId || typeof needConceptId !== 'string') {
      return reply.status(400).send({ ok: false, code: 'NEED_CONCEPT_ID_REQUIRED' });
    }
    const { eventOperationalNeedsService } = await import('./event-operational-needs.service');
    const need = await eventOperationalNeedsService.add(tenantId, req.params.id, needConceptId);
    // Fora das sugestões governadas do formato → 422 (não catálogo livre nesta v1).
    if (!need) return reply.status(422).send({ ok: false, code: 'NEED_NOT_IN_FORMAT_SUGGESTIONS' });
    return reply.status(201).send({ ok: true, need: { needConceptId: need.needConceptId, fulfillmentKind: need.fulfillmentKind, status: need.status } });
  });

  fastify.delete<{ Params: { id: string; needConceptId: string } }>('/:id/operational-needs/:needConceptId', async (req, reply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const tenantId = req.tenant.id;
    await assertRepresentsEventOwner(tenantId, req.user?.userId, req.params.id, 'manage_events');
    const { eventOperationalNeedsService } = await import('./event-operational-needs.service');
    await eventOperationalNeedsService.remove(tenantId, req.params.id, req.params.needConceptId);
    return reply.status(200).send({ ok: true });
  });

  /**
   * PATCH /events/:id/audience — DECISION-0161 (writer mínimo da plateia).
   * Organizer-gated (resolveRepresentedActor sobre event.actor_id, fail-closed). Seta o MACRO
   * (visibility, validado pelo CHECK existente) + refinamento (audience_relationship_types, validado
   * pelo CHECK do subconjunto governado — o banco é a última linha).
   */
  fastify.patch<{ Params: { id: string }; Body: { visibility?: string; audienceRelationshipTypes?: string[] | null } }>(
    '/:id/audience',
    async (req, reply) => {
      if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
      const tenantId = req.tenant.id;
      const actorId = req.actionContext?.actorId;
      if (!actorId) return reply.status(400).send({ ok: false, code: 'ACTION_CONTEXT_REQUIRED' });
      const evRows = await runQueryWithTenant<{ actor_id: string }>(
        tenantId, `SELECT actor_id FROM events WHERE tenant_id = $1 AND id = $2`, [tenantId, req.params.id]
      );
      if (!evRows) return reply.status(404).send({ ok: false, code: 'EVENT_NOT_FOUND' });
      try {
        await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          actorId
        );
      } catch {
        return reply.status(403).send({ ok: false, code: 'ACTOR_NOT_REPRESENTABLE' });
      }
      if (evRows.actor_id !== actorId) {
        return reply.status(403).send({ ok: false, code: 'NOT_EVENT_ORGANIZER' });
      }
      // 🔒 DECISION-0189A §3 (D4): plateia é WRITE de evento — exige manage_events exato.
      if (!(await userCanActOnActor(tenantId, req.user?.userId, evRows.actor_id, 'manage_events'))) {
        return reply.status(403).send({ ok: false, code: 'MANAGE_EVENTS_REQUIRED' });
      }
      const vis = req.body?.visibility;
      const aud = req.body?.audienceRelationshipTypes ?? null;
      if (!vis && aud === null) return reply.status(400).send({ ok: false, code: 'AUDIENCE_EMPTY_PATCH' });
      // Só vocabulário CANÔNICO em novos writes (F-EVENT-AUDIENCE-SSOT-UNIFICATION). Legado
      // (group/followers/private/unlisted) rejeitado com erro claro — o CHECK do banco é a última linha.
      if (vis && !['public', 'connections', 'only_me'].includes(vis)) {
        return reply.status(400).send({ ok: false, code: 'AUDIENCE_VISIBILITY_LEGACY', message: `visibility '${vis}' não é canônico (use public|connections|only_me).` });
      }
      try {
        await runQueryWithTenant(
          tenantId,
          `UPDATE events SET
             visibility = COALESCE($3, visibility),
             audience_relationship_types = $4,
             updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2`,
          [tenantId, req.params.id, vis ?? null, aud]
        );
      } catch (e) {
        // CHECKs do banco (visibility / subconjunto governado) = fail-closed com erro honesto.
        return reply.status(400).send({ ok: false, code: 'AUDIENCE_VOCABULARY_REJECTED', message: (e as Error).message.slice(0, 160) });
      }
      return reply.send({ ok: true });
    }
  );

  /**
   * POST /events
   * Cria um novo evento
   */
  fastify.post<{
    Body: CreateEventBodyRaw;
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['actor_id', 'actor_type', 'event_type', 'title'],
          properties: {
            actor_id: { type: 'string', format: 'uuid' },
            actor_type: { type: 'string', enum: ['user', 'page'] },
            event_type: {
              type: 'string',
              enum: ['cultural', 'gastronomic', 'social', 'professional', 'community', 'spiritual', 'sports', 'private'],
            },
            event_subtype: { type: ['string', 'null'] },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'] },
            datetime_start: { type: ['string', 'null'], format: 'date-time' },
            datetime_end: { type: ['string', 'null'], format: 'date-time' },
            visibility: {
              type: 'string',
              enum: ['public', 'connections', 'only_me'],
            },
            ticket_price_cents: { type: ['integer', 'null'], minimum: 0 },
            max_attendees: { type: ['integer', 'null'], minimum: 1 },
            metadata: { type: ['object', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        // Obter actor do ActionContext
        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        // Rate limiting: criação de eventos
        const rateLimit = await eventRateLimitService.checkCreateRateLimit(
          req.tenant.id,
          userActor.actor_id
        );
        if (!rateLimit.allowed) {
          return sendEventHttpError(
            reply,
            req,
            429,
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Event creation rate limit exceeded',
            { resetAt: rateLimit.resetAt.toISOString() }
          );
        }

        // 🔒 DECISION-0189A §2/§3 (Finding A): a DECISÃO da criação é a CHAVE EXATA create_events
        // sobre o actor ORGANIZADOR declarado (canActAs: membro com can_create_events · governança ·
        // delegação exata · PF=self). Representação isolada NÃO autoriza (D2/D3).
        if (!(await userCanActOnActor(req.tenant.id, req.user.userId, req.body.actor_id, 'create_events'))) {
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            'Sem a permissão exata create_events sobre o actor organizador (DECISION-0189A)'
          );
        }

        // Verificar débitos pendentes do actor efetivo (CONTRATO v1.4: bloqueia criação)
        // CORREÇÃO: Verificar débitos do actor que está criando o evento (pode ser user ou page)
        const { penaltyService } = await import('@core/reputation/penalty.service');
        const effectiveActorType = req.body.actor_type as 'user' | 'page';
        const debtCheck = await penaltyService.hasPendingDebts(
          req.tenant.id,
          req.body.actor_id,
          effectiveActorType
        );
        if (debtCheck.hasDebt) {
          const amountReais = (debtCheck.totalAmountCents! / 100).toFixed(2);
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            `Account blocked: pending debt (BRL ${amountReais}). Settle to continue.`
          );
        }
        
        // 🔴 A1c (EVENT-ENGINE-COMPLETION, §2/§4.8): WRITER ÚNICO. Esta ROTA legada eventType-based
        // (POST /api/events/, órfã — sem FE) fica CONTIDA: entrada única de criação = guided flow governado
        // (POST /api/events/v2/create). Contém a ROTA, NÃO o método core createEvent (canônico via /v2/create
        // + createEventBoundToGroup). 501 honesto ANTES da chamada ao writer. Corpo original abaixo (dead-code).
        return sendEventHttpError(reply, req, 501, 'EVENT_LEGACY_WRITER_CONVERGED', 'Rota legada de criação de evento contida — use POST /api/events/v2/create (guided flow format-first).');

        const event = await eventService.createEvent(req.tenant.id, toCreateEventInput(req.body));

        // Enfileirar evento na outbox para criar post no feed (worker → bus canónico)
        try {
          const tenantId = req.tenant.id;
          const outboxClient = await getClientWithTenant(tenantId);
          try {
            await outboxClient.query('BEGIN');
            await insertEventOutboxRow(outboxClient, {
              tenantId,
              eventId: outboxEventIdFromSeed(`event.created:${tenantId}:${event.id}`),
              eventType: 'event.created',
              eventVersion: 1,
              payload: {
                eventId: event.id,
                actorId: event.actorId,
                globalUserId: req.actionContext!.actorId,
                title: event.title,
                description: event.description,
                eventType: event.eventType,
                createdByGlobalUserId: req.actionContext!.actorId,
              },
            });
            await outboxClient.query('COMMIT');
          } catch (inner) {
            await outboxClient.query('ROLLBACK');
            throw inner;
          } finally {
            outboxClient.release();
          }
        } catch (err) {
          // Não quebra criação do evento se outbox falhar
          fastify.log.warn({ err }, 'Erro ao enfileirar event.created na outbox (não crítico)');
        }

        // Log estruturado: criação de evento
        fastify.log.info({
          tenant_id: req.tenant.id,
          actor_id: userActor.actor_id,
          event_id: event.id,
          event_type: event.eventType,
          ticket_price_cents: event.ticketPriceCents,
          'economy.action': 'event.created',
        }, 'Evento criado');

        return reply.status(201).send({ event });
      } catch (error) {
        // Log estruturado: erro ao criar evento
        if (error instanceof BadRequestError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            actor_id: req.body?.actor_id,
            error: error.message,
            'economy.action': 'event.create.error',
            error_type: 'BadRequestError',
          }, 'Erro ao criar evento (validação)');
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            actor_id: req.body?.actor_id,
            error: error.message,
            'economy.action': 'event.create.error',
            error_type: 'NotFoundError',
          }, 'Erro ao criar evento (não encontrado)');
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            actor_id: req.body?.actor_id,
            error: error.message,
            'economy.action': 'event.create.error',
            error_type: 'ForbiddenError',
          }, 'Erro ao criar evento (permissão)');
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        
        fastify.log.error({
          tenant_id: req.tenant?.id,
          actor_id: req.body?.actor_id,
          err: error,
          'economy.action': 'event.create.error',
          error_type: 'UnexpectedError',
        }, 'Erro inesperado ao criar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to create event');
      }
    }
  );

  /**
   * PATCH /events/:id
   * Atualiza um evento existente
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateEventInput;
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'] },
            datetime_start: { type: 'string', format: 'date-time' },
            datetime_end: { type: 'string', format: 'date-time' },
            event_subtype: { type: ['string', 'null'] },
            visibility: {
              type: 'string',
              enum: ['public', 'connections', 'only_me'],
            },
            ticket_price_cents: { type: ['integer', 'null'], minimum: 0 },
            max_attendees: { type: ['integer', 'null'], minimum: 1 },
            // Acesso/custo + capacidade mínima (anúncio, Δbank=0).
            event_access_type: { type: ['string', 'null'], enum: ['gratuito', 'pago', 'contribuicao_opcional', null] },
            min_attendees: { type: ['integer', 'null'], minimum: 1 },
            // VAQUINHA (all-or-nothing) — regras DECLARADAS (SLICE S1). Δbank=0: META = min_attendees (pessoas),
            // dinheiro real = PORTA-01, FORA. funding_deadline_at = PRAZO da vaquinha (≠ datetime_end = fim do evento).
            funding_deadline_at: { type: ['string', 'null'], format: 'date-time' },
            is_all_or_nothing: { type: 'boolean' },
            metadata: { type: ['object', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');
        
        // Body é snake_case no contrato HTTP; updateEvent usa camelCase. De-para explícito (mesmo
        // motivo do /v2/declare) — sem isto, ticket_price_cents/max_attendees/etc. chegavam undefined.
        const ub = req.body as unknown as Record<string, unknown>;
        const has = (k: string) => Object.prototype.hasOwnProperty.call(ub, k);
        const updateInput: Record<string, unknown> = {};
        if (has('title')) updateInput.title = ub.title;
        if (has('description')) updateInput.description = ub.description;
        if (has('datetime_start') || has('datetimeStart')) updateInput.datetimeStart = ub.datetime_start ?? ub.datetimeStart;
        if (has('datetime_end') || has('datetimeEnd')) updateInput.datetimeEnd = ub.datetime_end ?? ub.datetimeEnd;
        if (has('event_subtype') || has('eventSubtype')) updateInput.eventSubtype = ub.event_subtype ?? ub.eventSubtype;
        if (has('visibility')) updateInput.visibility = ub.visibility;
        if (has('ticket_price_cents') || has('ticketPriceCents')) updateInput.ticketPriceCents = ub.ticket_price_cents ?? ub.ticketPriceCents;
        if (has('max_attendees') || has('maxAttendees')) updateInput.maxAttendees = ub.max_attendees ?? ub.maxAttendees;
        if (has('event_access_type') || has('eventAccessType')) updateInput.eventAccessType = ub.event_access_type ?? ub.eventAccessType;
        if (has('min_attendees') || has('minAttendees')) updateInput.minAttendees = ub.min_attendees ?? ub.minAttendees;
        // VAQUINHA (all-or-nothing) — regras DECLARADAS (SLICE S1). Δbank=0 (META = min_attendees/pessoas;
        // dinheiro = PORTA-01, FORA). funding_deadline_at = PRAZO da vaquinha, NUNCA datetime_end (fim do evento).
        if (has('funding_deadline_at') || has('fundingDeadlineAt')) updateInput.fundingDeadlineAt = ub.funding_deadline_at ?? ub.fundingDeadlineAt;
        if (has('is_all_or_nothing') || has('isAllOrNothing')) updateInput.isAllOrNothing = ub.is_all_or_nothing ?? ub.isAllOrNothing;
        if (has('event_format_concept_id') || has('eventFormatConceptId')) updateInput.eventFormatConceptId = ub.event_format_concept_id ?? ub.eventFormatConceptId;
        if (has('location_mode') || has('locationMode')) updateInput.locationMode = ub.location_mode ?? ub.locationMode;
        if (has('theme_concept_ids') || has('themeConceptIds')) updateInput.themeConceptIds = ub.theme_concept_ids ?? ub.themeConceptIds;
        if (has('category_facets') || has('categoryFacets')) updateInput.categoryFacets = ub.category_facets ?? ub.categoryFacets;
        if (has('venue_city_id') || has('venueCityId')) updateInput.venueCityId = ub.venue_city_id ?? ub.venueCityId;
        if (has('venue_neighborhood_id') || has('venueNeighborhoodId')) updateInput.venueNeighborhoodId = ub.venue_neighborhood_id ?? ub.venueNeighborhoodId;
        if (has('venue_neighborhood_display') || has('venueNeighborhoodDisplay')) updateInput.venueNeighborhoodDisplay = ub.venue_neighborhood_display ?? ub.venueNeighborhoodDisplay;
        if (has('venue_postal_code') || has('venuePostalCode')) updateInput.venuePostalCode = ub.venue_postal_code ?? ub.venuePostalCode;
        // SLICE S2 (VENUE ENRICHMENT): logradouro do local REUSA addresses.street/number/complement (colunas
        // existentes); Nome do Local REUSA a chave canônica events.metadata.location_name (input key = locationName).
        if (has('venue_street') || has('venueStreet')) updateInput.venueStreet = ub.venue_street ?? ub.venueStreet;
        if (has('venue_number') || has('venueNumber')) updateInput.venueNumber = ub.venue_number ?? ub.venueNumber;
        if (has('venue_complement') || has('venueComplement')) updateInput.venueComplement = ub.venue_complement ?? ub.venueComplement;
        if (has('location_name') || has('locationName')) updateInput.locationName = ub.location_name ?? ub.locationName;
        if (has('metadata')) updateInput.metadata = ub.metadata;
        const event = await eventService.updateEvent(
          req.tenant.id,
          req.params.id,
          updateInput as Parameters<typeof eventService.updateEvent>[2],
          userActor.actor_id
        );

        // Log estruturado: atualização de evento
        fastify.log.info({
          tenant_id: req.tenant.id,
          actor_id: userActor.actor_id,
          event_id: event.id,
          'economy.action': 'event.updated',
        }, 'Evento atualizado');

        return reply.status(200).send({ event });
      } catch (error) {
        // Log estruturado: erro ao atualizar evento
        if (error instanceof BadRequestError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.update.error',
            error_type: 'BadRequestError',
          }, 'Erro ao atualizar evento (validação)');
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.update.error',
            error_type: 'NotFoundError',
          }, 'Erro ao atualizar evento (não encontrado)');
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.update.error',
            error_type: 'ForbiddenError',
          }, 'Erro ao atualizar evento (permissão)');
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        
        // HONESTIDADE DE SCHEMA: se o Postgres disse que falta coluna/tabela (42703/42P01), o
        // catch-all NAO pode devolver "Failed to update event" — isso esconde a causa real
        // (banco conectado sem as migrations desta funcionalidade) e custa depuracao. Reportamos
        // o que o proprio Postgres declarou. Deteccao NARROW: qualquer outro erro segue o 500 abaixo.
        const schemaDrift = describePostgresSchemaError(error);
        if (schemaDrift) {
          fastify.log.error({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            err: error,
            'economy.action': 'event.update.error',
            error_type: 'SchemaOutOfDateError',
            pg_code: schemaDrift.details.pg_code,
            missing_object: schemaDrift.details.missing_object,
          }, 'Schema do banco conectado nao atende esta funcionalidade');
          return sendEventHttpError(
            reply,
            req,
            schemaDrift.httpStatus,
            ErrorCode.SCHEMA_OUT_OF_DATE,
            schemaDrift.message,
            schemaDrift.details as unknown as Record<string, unknown>
          );
        }

        fastify.log.error({
          tenant_id: req.tenant?.id,
          event_id: req.params.id,
          err: error,
          'economy.action': 'event.update.error',
          error_type: 'UnexpectedError',
        }, 'Erro inesperado ao atualizar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to update event');
      }
    }
  );

  /**
   * POST /events/:id/publish
   * Publica um evento (muda status de draft para published)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/publish',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        // Buscar evento para obter actor efetivo (pode ser user ou page)
        // CORREÇÃO: Verificar débitos do actor do evento, não sempre do user
        const event = await eventService.getEvent(req.tenant.id, req.params.id);
        if (!event) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Event not found');
        }

        // Verificar débitos pendentes do actor efetivo do evento (CONTRATO v1.4: bloqueia publicação)
        const { penaltyService } = await import('@core/reputation/penalty.service');
        const effectiveActorType = event.actorType as 'user' | 'page';
        const debtCheck = await penaltyService.hasPendingDebts(
          req.tenant.id,
          event.actorId,
          effectiveActorType
        );
        if (debtCheck.hasDebt) {
          const amountReais = (debtCheck.totalAmountCents! / 100).toFixed(2);
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            `Account blocked: pending debt (BRL ${amountReais}). Settle to continue.`
          );
        }

        // Rate limiting: publicação de eventos
        const rateLimit = await eventRateLimitService.checkPublishRateLimit(
          req.tenant.id,
          userActor.actor_id
        );
        if (!rateLimit.allowed) {
          return sendEventHttpError(
            reply,
            req,
            429,
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Event publish rate limit exceeded',
            { resetAt: rateLimit.resetAt.toISOString() }
          );
        }
        
        const publishedEvent = await eventService.publishEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        // Log estruturado: publicação de evento
        fastify.log.info({
          tenant_id: req.tenant.id,
          actor_id: userActor.actor_id,
          event_id: publishedEvent.id,
          event_type: publishedEvent.eventType,
          ticket_price_cents: publishedEvent.ticketPriceCents,
          'economy.action': 'event.published',
        }, 'Evento publicado');

        return reply.status(200).send({ event: publishedEvent });
      } catch (error) {
        // Log estruturado: erro ao publicar evento
        if (error instanceof BadRequestError) {
          // Verificar se é erro econômico
          const isEconomyError = error.message.includes('economia') || error.message.includes('split');
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': isEconomyError ? 'event.publish.error.economy' : 'event.publish.error',
            error_type: 'BadRequestError',
          }, isEconomyError ? 'Erro ao publicar evento (economia inválida)' : 'Erro ao publicar evento (validação)');
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.publish.error',
            error_type: 'NotFoundError',
          }, 'Erro ao publicar evento (não encontrado)');
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.publish.error',
            error_type: 'ForbiddenError',
          }, 'Erro ao publicar evento (permissão)');
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        
        fastify.log.error({
          tenant_id: req.tenant?.id,
          event_id: req.params.id,
          err: error,
          'economy.action': 'event.publish.error',
          error_type: 'UnexpectedError',
        }, 'Erro inesperado ao publicar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to publish event');
      }
    }
  );

  /**
   * POST /events/:id/cancel
   * Cancela um evento (muda status para cancelled)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/cancel',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');
        
        const event = await eventService.cancelEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        // Log estruturado: cancelamento de evento
        fastify.log.info({
          tenant_id: req.tenant.id,
          actor_id: userActor.actor_id,
          event_id: event.id,
          'economy.action': 'event.cancelled',
        }, 'Evento cancelado');

        return reply.status(200).send({ event });
      } catch (error) {
        // Log estruturado: erro ao cancelar evento
        if (error instanceof BadRequestError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.cancel.error',
            error_type: 'BadRequestError',
          }, 'Erro ao cancelar evento (validação)');
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.cancel.error',
            error_type: 'NotFoundError',
          }, 'Erro ao cancelar evento (não encontrado)');
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            error: error.message,
            'economy.action': 'event.cancel.error',
            error_type: 'ForbiddenError',
          }, 'Erro ao cancelar evento (permissão)');
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        
        fastify.log.error({
          tenant_id: req.tenant?.id,
          event_id: req.params.id,
          err: error,
          'economy.action': 'event.cancel.error',
          error_type: 'UnexpectedError',
        }, 'Erro inesperado ao cancelar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to cancel event');
      }
    }
  );

  /**
   * GET /events/:id
   * Busca um evento por ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const event = await eventService.getEvent(req.tenant.id, req.params.id);

        if (!event) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Event not found');
        }

        // 🔵 DECISION-0113 F6.5.6b-CANAL5-A: acesso por ID herda o modelo de visibility da discovery (B1–B4).
        // Deny-first → 404 não-leak (não confirma existência) para evento que o caller não pode ver.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { canViewEvent } = await import('./event-visibility.service');
        if (!(await canViewEvent(req.tenant.id, req.params.id, callerUserId))) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Event not found');
        }

        return reply.status(200).send({ event });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch event');
      }
    }
  );

  /**
   * POST /events/:id/checkout
   * Processa checkout de ingresso de evento
   * CONTRATO v1: Executa split, grava ledger, cria attendee
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      attendee_actor_id: string;
      quantity?: number;
    };
  }>(
    '/:id/checkout',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['attendee_actor_id'],
          properties: {
            attendee_actor_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        // Validar que attendee_actor_id corresponde ao usuário autenticado
        // CORREÇÃO: attendee_actor_id pode ser user ou page, precisamos descobrir o tipo
        const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const actorRepository = socialPortsRegistry.getActorRepository();
        const attendeeActor = await actorRepository.findById(req.tenant.id, req.body.attendee_actor_id);
        if (!attendeeActor) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Actor (attendee) not found');
        }

        // 🔴 F-0113-EVENT-ACTOR-BODY-BINDING: attendee_actor_id é HINT. O utilizador autenticado DEVE
        // representá-lo server-side (canRepresentActor) ANTES de qualquer fluxo econômico (processCheckout).
        // Fail-closed; substitui o match contra actionContext. NÃO toca o motor financeiro.
        if (!(await userRepresentsActor(req.tenant.id, req.user.userId, req.body.attendee_actor_id))) {
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            'Sem autoridade para representar o attendee declarado'
          );
        }

        // Verificar débitos pendentes do actor efetivo (CONTRATO v1.4: bloqueia checkout)
        // CORREÇÃO: Verificar débitos do attendee_actor (pode ser user ou page)
        const { penaltyService } = await import('@core/reputation/penalty.service');
        const effectiveActorType = attendeeActor.actor_type as 'user' | 'page';
        const debtCheck = await penaltyService.hasPendingDebts(
          req.tenant.id,
          req.body.attendee_actor_id,
          effectiveActorType
        );
        if (debtCheck.hasDebt) {
          const amountReais = (debtCheck.totalAmountCents! / 100).toFixed(2);
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            `Account blocked: pending debt (BRL ${amountReais}). Settle to continue.`
          );
        }

        // Rate limiting: checkout
        const rateLimit = await eventRateLimitService.checkCheckoutRateLimit(
          req.tenant.id,
          userActor.actor_id
        );
        if (!rateLimit.allowed) {
          return sendEventHttpError(
            reply,
            req,
            429,
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Checkout rate limit exceeded',
            { resetAt: rateLimit.resetAt.toISOString() }
          );
        }

        const result = await eventEconomyService.processCheckout(req.tenant.id, {
          eventId: req.params.id,
          attendeeActorId: req.body.attendee_actor_id,
          quantity: req.body.quantity || 1,
        });

        // Log estruturado: checkout
        fastify.log.info({
          tenant_id: req.tenant.id,
          actor_id: userActor.actor_id,
          event_id: result.eventId,
          attendee_id: result.attendeeId,
          transaction_id: result.transactionId,
          total_amount_cents: result.totalAmountCents,
          'economy.action': 'event.checkout',
        }, 'Checkout de evento processado');

        return reply.status(200).send({ 
          checkout: {
            event_id: result.eventId,
            attendee_id: result.attendeeId,
            transaction_id: result.transactionId,
            total_amount_cents: result.totalAmountCents,
            splits: result.splitResult.splits.map((split) => ({
              target_type: split.rule.targetType,
              percentage: split.rule.percentage,
              amountCents: split.amountCents,
              transaction_id: split.transactionId,
            })),
          }
        });
      } catch (error) {
        // Log estruturado: erro ao processar checkout
        if (error instanceof BadRequestError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            attendee_actor_id: req.body?.attendee_actor_id,
            error: error.message,
            'economy.action': 'event.checkout.error',
            error_type: 'BadRequestError',
          }, 'Erro ao processar checkout (validação)');
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            attendee_actor_id: req.body?.attendee_actor_id,
            error: error.message,
            'economy.action': 'event.checkout.error',
            error_type: 'NotFoundError',
          }, 'Erro ao processar checkout (não encontrado)');
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          fastify.log.warn({
            tenant_id: req.tenant?.id,
            event_id: req.params.id,
            attendee_actor_id: req.body?.attendee_actor_id,
            error: error.message,
            'economy.action': 'event.checkout.error',
            error_type: 'ForbiddenError',
          }, 'Erro ao processar checkout (permissão)');
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        
        fastify.log.error({
          tenant_id: req.tenant?.id,
          event_id: req.params.id,
          attendee_actor_id: req.body?.attendee_actor_id,
          err: error,
          'economy.action': 'event.checkout.error',
          error_type: 'UnexpectedError',
        }, 'Erro inesperado ao processar checkout');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Failed to process checkout');
      }
    }
  );

  /**
   * ============================================================
   * ROTAS V2 - EVENT DOMAIN MINIMUM CONTRACT
   * ============================================================
   * Rotas canônicas para lifecycle mínimo do evento
   * Sem economia, sem agenda write, sem efeitos externos
   */

  /**
   * POST /events/v2/draft
   * Cria evento em draft (exige actor explícito)
   */
  fastify.post<{
    Body: CreateEventBodyRaw;
  }>(
    '/v2/draft',
    {
      schema: {
        body: {
          type: 'object',
          required: ['actor_id', 'actor_type', 'title'], // event_type NÃO é mais obrigatório (formato-first)
          properties: {
            actor_id: { type: 'string', format: 'uuid' },
            actor_type: { type: 'string', enum: ['user', 'page'] },
            event_type: {
              type: ['string', 'null'],
              enum: ['cultural', 'gastronomic', 'social', 'professional', 'community', 'spiritual', 'sports', 'private', null],
            },
            event_subtype: { type: ['string', 'null'] },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'] },
            datetime_start: { type: ['string', 'null'], format: 'date-time' },
            datetime_end: { type: ['string', 'null'], format: 'date-time' },
            visibility: {
              type: 'string',
              enum: ['public', 'connections', 'only_me'],
            },
            ticket_price_cents: { type: ['integer', 'null'], minimum: 0 },
            max_attendees: { type: ['integer', 'null'], minimum: 1 },
            metadata: { type: ['object', 'null'] },
            // DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC: opcional; omitido preserva o DEFAULT 'UTC' do banco.
            timezone: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        // 🔒 DECISION-0189A §2/§3 (Finding A): draft é CRIAÇÃO — chave exata create_events sobre o
        // actor organizador declarado (representação isolada não autoriza).
        if (!(await userCanActOnActor(req.tenant.id, req.user.userId, req.body.actor_id, 'create_events'))) {
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            'Sem autoridade para representar o actor declarado'
          );
        }

        // V2: responsible_actor obrigatório (exigido explicitamente)
        const event = await eventService.createDraftEvent(req.tenant.id, toCreateEventInput(req.body));

        return reply.status(201).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao criar draft de evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while creating event');
      }
    }
  );

  /**
   * POST /events/:id/v2/declare
   * Declara evento (draft -> declared)
   */
  fastify.post<{
    Params: { id: string };
    Body: DeclareEventInput;
  }>(
    '/:id/v2/declare',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['title', 'visibility'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'] },
            event_aspects: { type: ['array', 'null'], items: { type: 'string' } },
            visibility: {
              type: 'string',
              enum: ['public', 'connections', 'only_me'],
            },
            intent_flags: { type: ['array', 'null'], items: { type: 'string' } },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        // O contrato HTTP é snake_case (event_aspects/intent_flags/...); o service usa camelCase
        // (DeclareEventInput). Mapeia aqui — sem esse de-para, eventAspects chegava undefined e o
        // declare falhava com "eventAspects é obrigatório" mesmo com o front enviando os aspects.
        const rawBody = req.body as unknown as Record<string, unknown>;
        const declareInput = {
          title: rawBody.title as string,
          description: (rawBody.description ?? null) as string | null,
          eventAspects: (rawBody.eventAspects ?? rawBody.event_aspects ?? []) as string[],
          visibility: rawBody.visibility as DeclareEventInput['visibility'],
          intentFlags: (rawBody.intentFlags ?? rawBody.intent_flags) as string[] | undefined,
          desiredTimeWindows: (rawBody.desiredTimeWindows ?? rawBody.desired_time_windows) as DeclareEventInput['desiredTimeWindows'],
          flexibilityLevel: (rawBody.flexibilityLevel ?? rawBody.flexibility_level) as DeclareEventInput['flexibilityLevel'],
          timezone: rawBody.timezone as string | undefined,
        };
        const event = await eventService.declareEvent(
          req.tenant.id,
          req.params.id,
          declareInput,
          userActor.actor_id
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao declarar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while declaring event');
      }
    }
  );

  /**
   * POST /events/:id/v2/publish
   * Publica evento (declared -> published)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/v2/publish',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        const event = await eventService.publishEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao publicar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while publishing event');
      }
    }
  );

  /**
   * POST /events/:id/v2/activate
   * Ativa evento (published -> active)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/v2/activate',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        const event = await eventService.activateEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao ativar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while activating event');
      }
    }
  );

  /**
   * POST /events/:id/v2/end
   * Encerra evento (active -> ended)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/v2/end',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        const event = await eventService.endEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao encerrar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while closing event');
      }
    }
  );

  /**
   * GET /events/:id/v2/availability-rich
   * Availability Rich Query por event_id (READ-ONLY, INFORMACIONAL)
   * EVENT_DOMAIN_MINIMUM_CONTRACT FASE 3
   * 
   * Analisa disponibilidade para cada janela declarada usando Agenda Universal.
   * Sem escrita. Sem mudança de estado. Apenas informação.
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/v2/availability-rich',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const richAvailability = await eventService.getEventAvailabilityRich(
          req.tenant.id,
          req.params.id
        );

        return reply.status(200).send({ availability: richAvailability });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao consultar rich availability do evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while querying rich availability');
      }
    }
  );

  /**
   * GET /events/:id/v2/availability
   * Consulta disponibilidade do evento na Agenda Universal (READ-ONLY)
   * EVENT_DOMAIN_MINIMUM_CONTRACT FASE 2
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      start?: string;
      end?: string;
      city_id?: string;
    };
  }>(
    '/:id/v2/availability',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            city_id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const availability = await eventService.getEventAvailability(
          req.tenant.id,
          req.params.id,
          {
            datetime_start: req.query.start,
            datetime_end: req.query.end,
            location_context: req.query.city_id ? { city_id: req.query.city_id } : undefined,
          }
        );

        return reply.status(200).send({ availability });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao consultar disponibilidade do evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while querying availability');
      }
    }
  );

  /**
   * ============================================================
   * ROTAS V2 - OPERATIONAL COMMITMENTS (FASE 4: sem economia)
   * ============================================================
   */

  /**
   * POST /events/:id/v2/commitments
   * Cria OperationalCommitment para um evento
   */
  fastify.post<{
    Params: { id: string };
    Body: CreateOperationalCommitmentBodyRaw;
  }>(
    '/:id/v2/commitments',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['responsible_actor_id', 'responsible_actor_type', 'role'],
          properties: {
            responsible_actor_id: { type: 'string', format: 'uuid' },
            responsible_actor_type: { type: 'string', enum: ['user', 'page', 'group', 'channel'] },
            role: { type: 'string' },
            time_window_ref: {
              type: ['object', 'null'],
              properties: {
                start_datetime: { type: 'string', format: 'date-time' },
                end_datetime: { type: 'string', format: 'date-time' },
                timezone: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔴 F-0113-EVENT-ACTOR-BODY-BINDING: responsible_actor_id é HINT — o utilizador autenticado DEVE
        // representar o actor que assume o commitment (fail-closed). Não inventa regra social de assignment
        // cross-actor; bloqueia atribuir commitment a actor não representado.
        if (!(await userRepresentsActor(req.tenant.id, req.user.userId, req.body.responsible_actor_id))) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, 'Sem autoridade para representar o responsible_actor declarado');
        }
        // 🔒 DECISION-0189A §3 (D4): atribuir commitment é ADMINISTRAR participantes/staff do
        // evento — exige manage_attendees exato sobre o dono do evento (carregado server-side).
        await assertEventExactAuthority(req.tenant.id, req.user.userId, req.params.id, 'manage_attendees');
        const commitment = await operationalCommitmentsService.createCommitment(
          req.tenant.id,
          toCreateOperationalCommitmentInput(req.params.id, req.body)
        );

        return reply.status(201).send({ commitment });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        // 🔴 C2a: assertEventExactAuthority (2ª cancela da autoridade DUAL) lança ForbiddenError — mapear p/
        // 403, coerente com os handlers irmãos (check-in/out/fail) e com a intenção documentada (§ helper).
        // Sem isto, negar manage_attendees virava 500 (gap deste handler), quebrando o contrato de autoridade.
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao criar commitment');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while creating commitment');
      }
    }
  );

  /**
   * GET /events/:id/v2/commitments
   * Lista OperationalCommitments de um evento
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/v2/commitments',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const commitments = await operationalCommitmentsService.listCommitmentsByEvent(
          req.tenant.id,
          req.params.id
        );

        return reply.status(200).send({ commitments });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao listar commitments');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while listing commitments');
      }
    }
  );

  /**
   * POST /commitments/:id/v2/check-in
   * Check-in de OperationalCommitment
   */
  fastify.post<{
    Params: { id: string };
    Body: CheckInInput;
  }>(
    '/commitments/:id/v2/check-in',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            observedAt: { type: ['string', 'null'], format: 'date-time' },
            observed_by_actor_id: { type: ['string', 'null'], format: 'uuid' },
            observed_by_actor_type: { type: ['string', 'null'], enum: ['user', 'page', 'group', 'channel'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔴 F3 FIX (YALA): a catraca ANTES só existia SE observed_by_actor_id viesse no body —
        // omitindo-o, o check-in rodava SEM autoridade (a catraca protegia o eixo errado). Agora
        // prova-se INCONDICIONALMENTE que o caller representa o dono do evento do commitment.
        const commitment0 = await operationalCommitmentsService.getCommitment(req.tenant.id, req.params.id);
        if (!commitment0) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Commitment não encontrado');
        }
        await assertRepresentsEventOwner(req.tenant.id, req.user?.userId, commitment0.eventId, 'manage_attendees');

        // 🔴 F-0113-EVENT-ACTOR-BODY-BINDING: se observed_by_actor_id for declarado no body (schema
        // runtime snake_case), o utilizador autenticado DEVE representá-lo (fail-closed).
        const checkInObservedBy = (req.body as { observed_by_actor_id?: string }).observed_by_actor_id;
        if (checkInObservedBy && !(await userRepresentsActor(req.tenant.id, req.user.userId, checkInObservedBy))) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, 'Sem autoridade para representar o observed_by_actor declarado');
        }
        const commitment = await operationalCommitmentsService.checkIn(
          req.tenant.id,
          req.params.id,
          req.body
        );

        return reply.status(200).send({ commitment });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao fazer check-in');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error during check-in');
      }
    }
  );

  /**
   * POST /commitments/:id/v2/check-out
   * Check-out de OperationalCommitment
   */
  fastify.post<{
    Params: { id: string };
    Body: CheckOutInput;
  }>(
    '/commitments/:id/v2/check-out',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            observedAt: { type: ['string', 'null'], format: 'date-time' },
            observed_by_actor_id: { type: ['string', 'null'], format: 'uuid' },
            observed_by_actor_type: { type: ['string', 'null'], enum: ['user', 'page', 'group', 'channel'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔴 F3 FIX (YALA): prova incondicional de representação do dono do evento (ver check-in).
        const commitment0 = await operationalCommitmentsService.getCommitment(req.tenant.id, req.params.id);
        if (!commitment0) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Commitment não encontrado');
        }
        await assertRepresentsEventOwner(req.tenant.id, req.user?.userId, commitment0.eventId, 'manage_attendees');

        // 🔴 F-0113-EVENT-ACTOR-BODY-BINDING: se observed_by_actor_id for declarado no body (schema
        // runtime snake_case), o utilizador autenticado DEVE representá-lo (fail-closed).
        const checkOutObservedBy = (req.body as { observed_by_actor_id?: string }).observed_by_actor_id;
        if (checkOutObservedBy && !(await userRepresentsActor(req.tenant.id, req.user.userId, checkOutObservedBy))) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, 'Sem autoridade para representar o observed_by_actor declarado');
        }
        const commitment = await operationalCommitmentsService.checkOut(
          req.tenant.id,
          req.params.id,
          req.body
        );

        return reply.status(200).send({ commitment });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao fazer check-out');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error during check-out');
      }
    }
  );

  /**
   * POST /commitments/:id/v2/fail
   * Marca OperationalCommitment como failed
   */
  fastify.post<{
    Params: { id: string };
    Body: MarkFailedInput;
  }>(
    '/commitments/:id/v2/fail',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['failure_reason'],
          properties: {
            failure_reason: { type: 'string' },
            observedAt: { type: ['string', 'null'], format: 'date-time' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔴 F2 FIX (YALA): antes qualquer autenticado marcava commitment/staff alheio como failed
        // (sabotagem de operação). Prova incondicional de representação do dono do evento.
        const commitment0 = await operationalCommitmentsService.getCommitment(req.tenant.id, req.params.id);
        if (!commitment0) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Commitment não encontrado');
        }
        await assertRepresentsEventOwner(req.tenant.id, req.user?.userId, commitment0.eventId, 'manage_attendees');

        const commitment = await operationalCommitmentsService.markFailed(
          req.tenant.id,
          req.params.id,
          req.body
        );

        return reply.status(200).send({ commitment });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao marcar como failed');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while marking as failed');
      }
    }
  );

  /**
   * POST /events/:id/v2/cancel
   * Cancela evento (* -> cancelled, exceto ended)
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/v2/cancel',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        const event = await eventService.cancelEvent(
          req.tenant.id,
          req.params.id,
          userActor.actor_id
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao cancelar evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while cancelling event');
      }
    }
  );

  /**
   * ============================================================
   * ROTAS V2 - EVENT CREATION ORCHESTRATION (FASE 5.0)
   * ============================================================
   */

  /**
   * POST /events/v2/create
   * Cria ou avança um RASCUNHO
   * Nunca "evento final"
   * Nunca confirma nada
   */
  fastify.post<{
    Body: CreateDraftInput;
  }>(
    '/v2/create',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            event: {
              type: 'object',
              properties: {
                actor_id: { type: 'string', format: 'uuid' },
                actor_type: { type: 'string', enum: ['user', 'page'] },
                event_type: { type: 'string' },
                title: { type: 'string' },
                description: { type: ['string', 'null'] },
                datetime_start: { type: ['string', 'null'], format: 'date-time' },
                datetime_end: { type: ['string', 'null'], format: 'date-time' },
                visibility: { type: 'string', enum: ['public', 'connections', 'only_me'] },
                max_attendees: { type: ['number', 'null'] },
                group_id: { type: ['string', 'null'], format: 'uuid' },
                // DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC: opcional; omitido preserva o DEFAULT 'UTC' do banco.
                timezone: { type: ['string', 'null'] },
              },
            },
            event_id: { type: ['string', 'null'], format: 'uuid' },
            group_id: { type: ['string', 'null'], format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        // 🔴 F-0113-EVENT-ACTOR-BODY-BINDING: o actor que cria/avança o draft (actionContext) e o actor
        // declarado no body (event.actor_id, se presente) são HINT — o utilizador autenticado DEVE
        // representá-los server-side (canRepresentActor), fail-closed.
        const declaredOwnerId = (req.body as { event?: { actor_id?: string } })?.event?.actor_id;
        // 🔒 DECISION-0189A §2/§3 (Finding A): criação v2 — chave exata create_events sobre o actor
        // ORGANIZADOR efetivo (declarado no body, senão o do contexto), resolvido server-side.
        if (!(await userCanActOnActor(req.tenant.id, req.user.userId, declaredOwnerId ?? userActor.actor_id, 'create_events'))) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, 'Sem a permissão exata create_events sobre o actor do evento (DECISION-0189A)');
        }

        // 🔴 FIX (achado de Clayton no navegador, 2026-07-06): o WIRE fala snake_case (schema desta rota:
        // event.event_type/event_id/datetime_start...) mas o service lê camelCase (CreateEventInput.eventType)
        // → eventType chegava UNDEFINED ("Event type 'undefined' não existe na taxonomia oficial") e o
        // caminho "avançar draft" (event_id) nunca casava. Normalização EXPLÍCITA na fronteira HTTP
        // (aceita ambos os formatos; camelCase interno é o canônico do service).
        const rawBody = req.body as Record<string, any>;
        const rawEvent = rawBody?.event as Record<string, any> | undefined;
        const normalized = {
          eventId: rawBody?.event_id ?? rawBody?.eventId ?? undefined,
          event: rawEvent
            ? {
                actorId: rawEvent.actor_id ?? rawEvent.actorId,
                actorType: rawEvent.actor_type ?? rawEvent.actorType,
                eventType: rawEvent.event_type ?? rawEvent.eventType,
                eventSubtype: rawEvent.event_subtype ?? rawEvent.eventSubtype ?? null,
                title: rawEvent.title,
                description: rawEvent.description ?? null,
                datetimeStart: rawEvent.datetime_start ?? rawEvent.datetimeStart ?? undefined,
                datetimeEnd: rawEvent.datetime_end ?? rawEvent.datetimeEnd ?? undefined,
                visibility: rawEvent.visibility ?? undefined,
                maxAttendees: rawEvent.max_attendees ?? rawEvent.maxAttendees ?? null,
                // F0-grupo: vínculo governado evento↔grupo. group_id vem do wire (event.group_id ou
                // top-level); actingUserId é SERVER-SIDE (req.user.userId), nunca do cliente — a
                // autoridade (representar o group-actor) é provada no writer transacional.
                group_id: rawEvent.group_id ?? rawEvent.groupId ?? rawBody?.group_id ?? undefined,
                actingUserId: req.user.userId,
                // DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC: opcional; omitido preserva o DEFAULT 'UTC' do
                // banco (createEvent normaliza e cai no default quando ausente/vazio).
                timezone: rawEvent.timezone ?? undefined,
              }
            : undefined,
        } as CreateDraftInput;

        const event = await eventCreationOrchestrator.createOrAdvanceDraft(
          req.tenant.id,
          userActor.actor_id,
          normalized
        );

        return reply.status(200).send({ 
          event: {
            ...event,
            responsible_actor_id: event.responsibleActorId || event.actorId,
            responsible_actor_type: event.responsibleActorType || event.actorType,
          }
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao criar ou avançar rascunho');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while creating or advancing draft');
      }
    }
  );

  /**
   * POST /events/:id/v2/time-windows
   * Define as janelas de tempo desejadas para o evento
   * Atualiza a EventDeclaration
   */
  fastify.post<{
    Params: { id: string };
    Body: SetTimeWindowsBodyRaw;
  }>(
    '/:id/v2/time-windows',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            desired_time_windows: {
              type: 'array',
              items: {
                type: 'object',
                required: ['start_datetime', 'end_datetime'],
                properties: {
                  start_datetime: { type: 'string', format: 'date-time' },
                  end_datetime: { type: 'string', format: 'date-time' },
                  timezone: { type: ['string', 'null'] },
                },
              },
            },
            flexibility_level: { type: ['string', 'null'], enum: ['strict', 'flexible', 'very_flexible'] },
            timezone: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );
        // 🔒 DECISION-0189A §3 (D4): writer sobre evento EXISTENTE — a decisão é a chave exata
        // manage_events sobre o dono do evento carregado server-side (representação não basta).
        await assertEventExactAuthority(req.tenant.id, req.user?.userId, req.params.id, 'manage_events');

        const event = await eventCreationOrchestrator.setTimeWindows(
          req.tenant.id,
          toSetTimeWindowsInput(req.params.id, req.body),
          userActor.actor_id
        );

        return reply.status(200).send({ event });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao definir janelas de tempo');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while setting time windows');
      }
    }
  );

  /**
   * GET /events/:id/v2/summary
   * Agrega estado declarativo completo
   * Apenas leitura
   * Nenhum side-effect
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/v2/summary',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const summary = await eventCreationOrchestrator.getSummary(
          req.tenant.id,
          req.params.id
        );

        return reply.status(200).send({ summary });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao obter resumo do evento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while fetching event summary');
      }
    }
  );

  /**
   * ============================================================
   * ROTAS V2 - ENDPOINTS ECONÔMICOS (FASE 6.0)
   * FASE_6_ENDPOINTS_ECONOMICOS_V2.md
   * ============================================================
   * 
   * 🔴 REGRAS ABSOLUTAS:
   * - Nenhum endpoint executa sem evento explícito
   * - Nenhum endpoint executa sem autorização explícita
   * - Nenhum endpoint cria efeito colateral silencioso
   * - Nenhum endpoint combina autorização + execução
   * 
   * Base path: /events/:eventId/economic/v2
   */

  /**
   * POST /events/:eventId/economic/v2/advance
   * Executar handoff da Fase 5.0 → Fase 6.0
   * Emite: event.advance_to_economic_phase
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<AdvanceToEconomicPhaseInput, 'event_id'>;
  }>(
    '/:eventId/economic/v2/advance',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['user_authorization', 'terms_accepted'],
          properties: {
            user_authorization: { type: 'boolean' },
            terms_accepted: { type: 'boolean' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        await eventEconomicPhaseService.advanceToEconomicPhase(
          req.tenant.id,
          userActor.actor_id,
          {
            event_id: req.params.eventId,
            ...req.body,
          }
        );

        return reply.status(200).send({ 
          message: 'Handoff para fase econômica executado. Evento emitido: event.advance_to_economic_phase',
          event_id: req.params.eventId,
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao executar handoff para fase econômica');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error during handoff');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/custody
   * Criar custódia
   * Emite: event.custody.created
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<CreateCustodyInput, 'event_id'>;
  }>(
    '/:eventId/economic/v2/custody',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['amount_cents', 'currency', 'economic_owner_id', 'economic_owner_type', 'purpose'],
          properties: {
            amount_cents: { type: 'number', minimum: 1 },
            currency: { type: 'string' },
            economic_owner_id: { type: 'string', format: 'uuid' },
            economic_owner_type: { type: 'string', enum: ['user', 'page', 'group', 'channel'] },
            release_conditions: {
              type: 'object',
              properties: {
                event_completed: { type: 'boolean' },
                payment_authorized: { type: 'boolean' },
                cancellation_approved: { type: 'boolean' },
                manual_release: { type: 'boolean' },
              },
            },
            purpose: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔒 B2f (DECISION-0131 §B7 / 0113): binding server-side ANTES de qualquer side-effect.
        // Só quem REPRESENTA o actor dono do evento pode mexer na economia dele. economic_owner_id
        // é DADO (beneficiário), não autoridade — a autoridade é sobre o EVENTO (canRepresentActor).
        const event = await eventService.getEvent(req.tenant.id, req.params.eventId);
        if (!event) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Event not found');
        }
        const canManageEconomy = await userRepresentsActor(req.tenant.id, req.user.userId, event.actorId);
        if (!canManageEconomy) {
          return sendEventHttpError(reply, req, 403, ErrorCode.PERMISSION_DENIED, 'Caller cannot represent the event owner for economic operations (custody).');
        }

        const custody = await eventCustodyService.createCustody(
          req.tenant.id,
          {
            event_id: req.params.eventId,
            ...req.body,
          }
        );

        return reply.status(201).send({ 
          custody,
          message: 'Custódia criada. Evento emitido: event.custody.created',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao criar custódia');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while creating custody');
      }
    }
  );

  /**
   * GET /events/:eventId/economic/v2/custody
   * Retorna estado atual da custódia (read-only)
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/economic/v2/custody',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const custodies = await eventCustodyService.listCustodiesByEvent(
          req.tenant.id,
          req.params.eventId
        );

        return reply.status(200).send({ custodies });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao listar custódias');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while listing custody records');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/split
   * Calcular split declarativo
   * Emite: event.split.calculated
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<CalculateSplitInput, 'event_id'>;
  }>(
    '/:eventId/economic/v2/split',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['custody_id', 'parts'],
          properties: {
            custody_id: { type: 'string', format: 'uuid' },
            parts: {
              type: 'array',
              items: {
                type: 'object',
                required: ['target_id', 'target_type', 'amount_cents', 'percentage', 'role'],
                properties: {
                  target_id: { type: 'string' },
                  target_type: { type: 'string', enum: ['user', 'page', 'group', 'channel', 'account'] },
                  amount_cents: { type: 'number', minimum: 0 },
                  percentage: { type: 'number', minimum: 0, maximum: 100 },
                  role: { type: 'string' },
                },
              },
            },
            rules_version: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔒 B2f (DECISION-0131 §B7 / 0113): binding server-side ANTES de qualquer side-effect.
        // Só quem REPRESENTA o actor dono do evento declara o split. parts[].target_id são
        // beneficiários (DADO), não autoridade — split multi-parte não exige representar cada target.
        const event = await eventService.getEvent(req.tenant.id, req.params.eventId);
        if (!event) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Event not found');
        }
        const canManageEconomy = await userRepresentsActor(req.tenant.id, req.user.userId, event.actorId);
        if (!canManageEconomy) {
          return sendEventHttpError(reply, req, 403, ErrorCode.PERMISSION_DENIED, 'Caller cannot represent the event owner for economic operations (split).');
        }

        const split = await eventSplitDeclarativeService.calculateSplit(
          req.tenant.id,
          {
            event_id: req.params.eventId,
            ...req.body,
          }
        );

        return reply.status(201).send({ 
          split,
          message: 'Split calculado. Evento emitido: event.split.calculated',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao calcular split');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while calculating split');
      }
    }
  );

  /**
   * GET /events/:eventId/economic/v2/split
   * Retorna split atual (read-only)
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/economic/v2/split',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        const splits = await eventSplitDeclarativeService.listSplitsByEvent(
          req.tenant.id,
          req.params.eventId
        );

        return reply.status(200).send({ splits });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao listar splits');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while listing splits');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/payment/authorize
   * Autorizar pagamento
   * Emite: event.payment.authorized
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<AuthorizePaymentInput, 'event_id'>;
  }>(
    '/:eventId/economic/v2/payment/authorize',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['custody_id', 'split_id', 'user_authorization'],
          properties: {
            custody_id: { type: 'string', format: 'uuid' },
            split_id: { type: 'string', format: 'uuid' },
            user_authorization: { type: 'boolean' },
            authorization_reason: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        const authorization = await eventPaymentPreparedService.authorizePayment(
          req.tenant.id,
          userActor.actor_id,
          {
            event_id: req.params.eventId,
            ...req.body,
          }
        );

        return reply.status(201).send({ 
          authorization,
          message: 'Pagamento autorizado. Evento emitido: event.payment.authorized',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao autorizar pagamento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while authorizing payment');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/payment/revoke
   * Revoga autorização antes da execução
   */
  fastify.post<{
    Params: { eventId: string };
    Body: { authorization_id: string; reason?: string };
  }>(
    '/:eventId/economic/v2/payment/revoke',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['authorization_id'],
          properties: {
            authorization_id: { type: 'string', format: 'uuid' },
            reason: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // 🔴 F1 FIX (YALA): provar autoridade sobre o DONO DO EVENTO da autorização e cruzar o
        // :eventId da URL (antes decorativo) com o event_id real — antes, qualquer autenticado
        // revogava autorização de pagamento alheia (BOLA/IDOR money-domain, irmão de V1).
        const existing = await eventPaymentPreparedService.getAuthorization(
          req.tenant.id,
          req.body.authorization_id
        );
        if (!existing) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Autorização de pagamento não encontrada');
        }
        if (existing.event_id !== req.params.eventId) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, 'Autorização não pertence ao evento informado');
        }
        await assertRepresentsEventOwner(req.tenant.id, req.user?.userId, existing.event_id);

        const authorization = await eventPaymentPreparedService.revokeAuthorization(
          req.tenant.id,
          req.body.authorization_id,
          req.body.reason || 'Autorização revogada pelo usuário'
        );

        return reply.status(200).send({ 
          authorization,
          message: 'Autorização revogada',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao revogar autorização');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while revoking authorization');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/payment/execute
   * Executar pagamento real
   * Emite: event.payment.executed
   * 
   * 🔴 NOTA: Este endpoint deve chamar serviço de execução REAL (se existir).
   * Por enquanto, apenas valida e emite evento.
   * Execução real será implementada em fase posterior.
   */
  fastify.post<{
    Params: { eventId: string };
    Body: { authorization_id: string; confirmation: boolean; sandbox_mode: boolean };
  }>(
    '/:eventId/economic/v2/payment/execute',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['authorization_id', 'confirmation', 'sandbox_mode'],
          properties: {
            authorization_id: { type: 'string', format: 'uuid' },
            confirmation: { type: 'boolean' },
            sandbox_mode: { type: 'boolean' }, // OBRIGATÓRIO: true para SANDBOX
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral (inclusive antes do writer real do Bank, hoje contido só pelo firewall). Corpo original
      // preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        if (!req.body.confirmation) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'Explicit confirmation is required');
        }

        if (req.body.sandbox_mode !== true) {
          return sendEventHttpError(
            reply,
            req,
            400,
            ErrorCode.VALIDATION_ERROR,
            'sandbox_mode=true is required. No real money will be moved.'
          );
        }

        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        // Verificar se há chargeback que congela execuções
        const hasFrozen = await eventRefundChargebackService.hasFrozenExecutions(
          req.tenant.id,
          req.params.eventId
        );
        if (hasFrozen) {
          return sendEventHttpError(
            reply,
            req,
            403,
            ErrorCode.FORBIDDEN,
            'Executions frozen due to active chargeback'
          );
        }

        // Buscar autorização
        const authorization = await eventPaymentPreparedService.getAuthorization(
          req.tenant.id,
          req.body.authorization_id
        );
        if (!authorization) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, 'Authorization not found');
        }
        if (authorization.event_id !== req.params.eventId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, 'Authorization does not belong to this event');
        }
        if (authorization.status !== 'authorized') {
          return sendEventHttpError(
            reply,
            req,
            400,
            ErrorCode.BAD_REQUEST,
            `Authorization is not in authorized state (status: ${authorization.status})`
          );
        }

        // Executar pagamento real (SANDBOX)
        const execution = await eventPaymentExecutionService.executePayment(
          req.tenant.id,
          {
            event_id: req.params.eventId,
            authorization_id: req.body.authorization_id,
            executed_by_actor_id: userActor.actor_id,
            sandbox_mode: req.body.sandbox_mode,
          }
        );

        return reply.status(200).send({ 
          execution,
          message: 'Pagamento executado em modo SANDBOX. Evento emitido: event.payment.executed',
        });
      } catch (error) {
        if (error instanceof IdempotencyMismatchError) {
          return reply.status(409).send(
            buildCanonicalHttpErrorPayload(
              error.code,
              IDEMPOTENCY_MISMATCH_HTTP_MESSAGE,
              eventRoutesReqId(req)
            )
          );
        }
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        if (error instanceof ForbiddenError) {
          return sendEventHttpError(reply, req, 403, ErrorCode.FORBIDDEN, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao executar pagamento');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while executing payment');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/refund
   * Solicitar estorno
   * Emite: event.refund.requested
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<RequestRefundInput, 'event_id' | 'requested_by_actor_id'>;
  }>(
    '/:eventId/economic/v2/refund',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['custody_id', 'refund_type', 'reason'],
          properties: {
            custody_id: { type: 'string', format: 'uuid' },
            refund_type: { type: 'string', enum: ['full', 'partial', 'chargeback', 'cancellation'] },
            amount_cents: { type: ['number', 'null'] },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        const refund = await eventRefundChargebackService.requestRefund(
          req.tenant.id,
          {
            event_id: req.params.eventId,
            requested_by_actor_id: userActor.actor_id,
            ...req.body,
          }
        );

        return reply.status(201).send({ 
          refund,
          message: 'Estorno solicitado. Evento emitido: event.refund.requested',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao solicitar estorno');
        return sendEventHttpError(reply, req, 500, ErrorCode.INTERNAL_ERROR, 'Internal error while requesting refund');
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/chargeback
   * Iniciar chargeback externo
   * Emite: event.chargeback.initiated
   */
  fastify.post<{
    Params: { eventId: string };
    Body: Omit<InitiateChargebackInput, 'event_id' | 'initiated_by_actor_id'>;
  }>(
    '/:eventId/economic/v2/chargeback',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['custody_id', 'amount_cents', 'reason'],
          properties: {
            custody_id: { type: 'string', format: 'uuid' },
            amount_cents: { type: 'number', minimum: 1 },
            external_reference: { type: ['string', 'null'] },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        const chargeback = await eventRefundChargebackService.initiateChargeback(
          req.tenant.id,
          {
            event_id: req.params.eventId,
            initiated_by_actor_id: userActor.actor_id,
            ...req.body,
          }
        );

        return reply.status(201).send({ 
          chargeback,
          message: 'Chargeback iniciado. Evento emitido: event.chargeback.initiated. Execuções congeladas.',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao iniciar chargeback');
        return sendEventHttpError(
          reply,
          req,
          500,
          ErrorCode.INTERNAL_ERROR,
          'Internal error while initiating chargeback'
        );
      }
    }
  );

  /**
   * POST /events/:eventId/economic/v2/chargeback/resolve
   * Resolver chargeback
   * Emite: event.chargeback.resolved
   */
  fastify.post<{
    Params: { eventId: string };
    Body: { chargeback_id: string; resolution: 'approved' | 'rejected'; resolution_reason?: string };
  }>(
    '/:eventId/economic/v2/chargeback/resolve',
    {
      schema: {
        params: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['chargeback_id', 'resolution'],
          properties: {
            chargeback_id: { type: 'string', format: 'uuid' },
            resolution: { type: 'string', enum: ['approved', 'rejected'] },
            resolution_reason: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9) — CONTENÇÃO HONESTA. Toda a família
      // HTTP economic/v2 permanece institucionalmente não implementada (substrato sandbox financeiro nunca
      // materializado) — 501 honesto como PRIMEIRA instrução do handler, ANTES de qualquer leitura/efeito
      // colateral. Corpo original preservado ABAIXO, intocado, para a futura frente material com GO próprio.
      return reply.status(501).send({
        error: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        code: 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED',
        message: 'Contenção honesta (DECISION-0190): esta operação da família economic/v2 aguarda substrato sandbox real, novo GO institucional e selo próprio antes de qualquer efeito colateral.',
      });

      if (!req.user) {
        return sendEventHttpError(reply, req, 401, ErrorCode.UNAUTHORIZED, 'Not authenticated');
      }

      if (!req.tenant) {
        return sendEventHttpError(reply, req, 400, ErrorCode.MISSING_TENANT, 'Tenant not found');
      }

      try {
        // ActionContext é obrigatório
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return sendEventHttpError(reply, req, 400, ErrorCode.VALIDATION_ERROR, 'ActionContext is required');
        }

        const userActor = await resolveRepresentedActor(
          req.tenant.id,
          req.user?.userId,
          req.actionContext.actorId
        );

        const resolution = req.body.resolution === 'approved' ? 'accepted' as const : 'disputed' as const;
        const chargeback = await eventRefundChargebackService.resolveChargeback(
          req.tenant.id,
          req.body.chargeback_id,
          userActor.actor_id,
          resolution,
          req.body.resolution_reason
        );

        return reply.status(200).send({ 
          chargeback,
          message: 'Chargeback resolvido. Evento emitido: event.chargeback.resolved',
        });
      } catch (error) {
        if (error instanceof BadRequestError) {
          return sendEventHttpError(reply, req, 400, ErrorCode.BAD_REQUEST, error.message);
        }
        if (error instanceof NotFoundError) {
          return sendEventHttpError(reply, req, 404, ErrorCode.NOT_FOUND, error.message);
        }
        fastify.log.error({ err: error }, 'Erro ao resolver chargeback');
        return sendEventHttpError(
          reply,
          req,
          500,
          ErrorCode.INTERNAL_ERROR,
          'Internal error while resolving chargeback'
        );
      }
    }
  );
};

export default eventRoutes;



