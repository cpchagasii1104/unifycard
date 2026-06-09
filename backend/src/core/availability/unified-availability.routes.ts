// src/core/availability/unified-availability.routes.ts
// Rotas do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 BLINDAGEM: NÃO cria lógica decisória automática

import { FastifyPluginAsync } from 'fastify';
import { unifiedAvailabilityService } from './unified-availability.service';
import { weeklyTemplateMaterializerService } from './weekly-template-materializer.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { BadRequestError } from '@core/errors';
import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';
import {
  AvailabilityOwnerType,
  UnifiedAvailabilityType,
  UnifiedAvailabilityStatus,
  UnifiedBookingStatus,
  ParticipantRole,
} from './unified-availability.types';

const createAvailabilitySchema = z.object({
  ownerType: z.nativeEnum(AvailabilityOwnerType), // OBRIGATÓRIO
  ownerId: z.string().uuid(), // OBRIGATÓRIO
  availabilityType: z.nativeEnum(UnifiedAvailabilityType).optional(),
  status: z.nativeEnum(UnifiedAvailabilityStatus).optional(),
  startDatetime: z.string().datetime(), // OBRIGATÓRIO
  endDatetime: z.string().datetime(), // OBRIGATÓRIO
  timezone: z.string().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateAvailabilitySchema = z.object({
  availabilityType: z.nativeEnum(UnifiedAvailabilityType).optional(),
  status: z.nativeEnum(UnifiedAvailabilityStatus).optional(),
  startDatetime: z.string().datetime().optional(),
  endDatetime: z.string().datetime().optional(),
  timezone: z.string().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const createBookingSchema = z.object({
  availabilityId: z.string().uuid(), // OBRIGATÓRIO
  requesterActorId: z.string().uuid(), // OBRIGATÓRIO
  notes: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateBookingSchema = z.object({
  status: z.nativeEnum(UnifiedBookingStatus).optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const checkInSchema = z.object({
  metadata: z.record(z.any()).optional(),
});

const checkOutSchema = z.object({
  metadata: z.record(z.any()).optional(),
});

// F1 (DECISION-0072 B1): contrato de entrada do materializador semanal.
// `schedule` é INPUT DECLARATIVO (grade semanal) — materializado em janelas concretas, NÃO persistido
// como blob. `timezone` IANA obrigatória (sem fallback silencioso). `horizonWeeks` clamp 8..12.
// `ownerType` restrito a user/page (actor humano/página); `ownerId` NÃO entra aqui (vem do actionContext).
const weeklyTemplateSchema = z.object({
  schedule: z.record(z.array(z.string())),
  timezone: z.string().min(1),
  horizonWeeks: z.number().int().min(8).max(12).optional(),
  ownerType: z.enum([AvailabilityOwnerType.USER, AvailabilityOwnerType.PAGE]).optional(),
});

/**
 * 🔴 DECISION-0113 canal-5 — autoridade de leitura de booking pelas PARTES REAIS do compromisso.
 * Booking é recurso privado: as partes são (1) `requesterActorId` (quem solicitou) e (2) o DONO REAL da
 * availability (`availability.ownerId`, que é o actorId). Autoriza se o req.user puder representar UMA das
 * partes. NÃO gateia em `params.id` (= bookingId, recurso) nem em `actionContext.actorId` (hint). Read-only,
 * fail-closed (qualquer erro → false). NÃO cria actor (sem ensureUserActor/getActiveActor).
 */
async function canReadBookingAsParty(
  tenantId: string,
  userId: string,
  booking: { requesterActorId?: string; availabilityId?: string }
): Promise<boolean> {
  // Parte 1: o solicitante (requesterActorId).
  if (booking.requesterActorId) {
    try {
      if (await authorizationService.canRepresentActor(tenantId, userId, booking.requesterActorId)) return true;
    } catch { /* fail-closed */ }
  }
  // Parte 2: o dono REAL da availability associada (availability.ownerId = actorId).
  if (booking.availabilityId) {
    try {
      const availability = await unifiedAvailabilityService.getAvailability(tenantId, booking.availabilityId);
      if (availability?.ownerId && await authorizationService.canRepresentActor(tenantId, userId, availability.ownerId)) {
        return true;
      }
    } catch { /* availability ausente/erro → fail-closed */ }
  }
  return false;
}

/**
 * 🔴 DECISION-0113 canal-5 — autoridade de leitura de participant (by-id) por OWNER-OR-SELF.
 * Participant é PII relacional privada (decisão diretora 2026-06-09: não vira vitrine social por acidente).
 * Autoriza se o req.user puder representar (1) o `participant.actorId` (o PRÓPRIO participante = self) OU
 * (2) o DONO REAL da availability associada (`availability.ownerId` = actorId). NÃO gateia em `params.id`
 * (= participantId, recurso) nem em `actionContext.actorId`. Read-only, fail-closed. Sem ensureUserActor/getActiveActor.
 */
async function canReadParticipantAsParty(
  tenantId: string,
  userId: string,
  participant: { actorId?: string; availabilityId?: string }
): Promise<boolean> {
  // Self: o próprio actor participante.
  if (participant.actorId) {
    try {
      if (await authorizationService.canRepresentActor(tenantId, userId, participant.actorId)) return true;
    } catch { /* fail-closed */ }
  }
  // Owner: dono REAL da availability associada.
  if (participant.availabilityId) {
    try {
      const availability = await unifiedAvailabilityService.getAvailability(tenantId, participant.availabilityId);
      if (availability?.ownerId && await authorizationService.canRepresentActor(tenantId, userId, availability.ownerId)) {
        return true;
      }
    } catch { /* availability ausente/erro → fail-closed */ }
  }
  return false;
}

const unifiedAvailabilityRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔴 HARDENING: Rate limiting para rotas sensíveis de availability
  await fastify.register(rateLimit as any, {
    max: 60, // 60 requests/min
    timeWindow: '1 minute',
    skipOnError: false,
  });

  /**
   * POST /availability
   * Criar nova disponibilidade
   * 🔴 BLINDAGEM: ownerType e ownerId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  fastify.post<{
    Body: z.infer<typeof createAvailabilitySchema>;
  }>(
    '/',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 canal-1 (WRITE): `body.ownerId` é o owner DECLARADO da availability — client-declared,
      // NÃO autoridade. Criar agenda operacional deve ser do PRÓPRIO owner: req.user precisa representá-lo E o
      // actionContext (autoria) deve coincidir com o owner (sem audit/autoria divergente). 401 sem user; 403
      // fail-closed. Sem admin escape (não há cross-owner legítimo de criação de availability).
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = createAvailabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // 🔴 CORE TEMPORAL: Bloquear schedule em metadata (violação do Core)
      if (parsed.data.metadata && typeof parsed.data.metadata === 'object') {
        if ('schedule' in parsed.data.metadata) {
          return reply.status(400).send({
            error: 'Invalid metadata',
            message: 'schedule não pode ser salvo em availability.metadata. AvailabilitySchedule é INPUT DECLARATIVO e não deve ser persistido como verdade temporal.',
          });
        }
      }

      // 🔴 gate owner-scoped: actionContext = owner (autoria coincide) + req.user representa o owner.
      if (req.actionContext.actorId !== parsed.data.ownerId) {
        return reply.status(403).send({
          ok: false,
          error: 'A autoria (actionContext) deve coincidir com o owner da availability',
          code: 'AVAILABILITY_WRITE_OWNER_MISMATCH',
        });
      }
      {
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, parsed.data.ownerId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({
            ok: false,
            error: 'Sem autoridade sobre o owner da availability (canRepresentActor)',
            code: 'AVAILABILITY_WRITE_NOT_REPRESENTABLE',
          });
        }
      }

      try {
        const availability = await unifiedAvailabilityService.createAvailability(
          req.tenant.id,
          req.actionContext.actorId,
          {
            ownerType: parsed.data.ownerType, // OBRIGATÓRIO
            ownerId: parsed.data.ownerId, // OBRIGATÓRIO
            availabilityType: parsed.data.availabilityType,
            status: parsed.data.status,
            startDatetime: new Date(parsed.data.startDatetime), // OBRIGATÓRIO
            endDatetime: new Date(parsed.data.endDatetime), // OBRIGATÓRIO
            timezone: parsed.data.timezone,
            capacity: parsed.data.capacity,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({
          ok: true,
          data: {
            availabilityId: availability.availabilityId,
            tenantId: availability.tenantId,
            ownerType: availability.ownerType,
            ownerId: availability.ownerId,
            availabilityType: availability.availabilityType,
            status: availability.status,
            startDatetime: availability.startDatetime.toISOString(),
            endDatetime: availability.endDatetime.toISOString(),
            timezone: availability.timezone,
            capacity: availability.capacity,
            metadata: availability.metadata,
            createdAt: availability.createdAt,
            updatedAt: availability.updatedAt,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /availability
   * Listar disponibilidades com filtros
   * 🔴 BLINDAGEM: Ordenação apenas por start_datetime ASC
   */
  fastify.get<{
    Querystring: {
      ownerType?: string;
      ownerId?: string;
      status?: string;
      startDatetime?: string;
      endDatetime?: string;
    };
  }>('/', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 + decisão diretora: availability operacional é PRIVADA por padrão (esta rota protegida
    // NÃO é vitrine pública de horários; discovery público = projeção/endpoint próprio futuro). Lista
    // OWNER-SCOPED: `query.ownerId` é HINT, não autoridade → exigir representar o owner ANTES de listar.
    // Sem ownerId representável → 403 fail-closed (nunca tenant-wide). 401 sem user. `ownerType` é só filtro.
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    {
      const ownerIdHint = req.query.ownerId;
      let canRep = false;
      if (ownerIdHint) {
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, ownerIdHint);
        } catch {
          canRep = false;
        }
      }
      if (!canRep) {
        return reply.status(403).send({
          ok: false,
          error: 'Listagem de availability exige ownerId representável (agenda operacional é privada)',
          code: 'AVAILABILITY_NOT_REPRESENTABLE',
        });
      }
    }

    const filters: any = {};
    try {
      if (req.query.ownerType) {
        filters.ownerType = req.query.ownerType as AvailabilityOwnerType;
      }
      if (req.query.ownerId) {
        filters.ownerId = req.query.ownerId;
      }
      if (req.query.status) {
        filters.status = req.query.status as UnifiedAvailabilityStatus;
      }
      if (req.query.startDatetime) {
        filters.startDatetime = new Date(req.query.startDatetime);
      }
      if (req.query.endDatetime) {
        filters.endDatetime = new Date(req.query.endDatetime);
      }

      const availabilities = await unifiedAvailabilityService.listAvailabilities(
        req.tenant.id,
        filters
      );

      // 🔧 FIX: Sempre retornar array, mesmo se vazio
      return reply.send({
        ok: true,
        data: availabilities.map(a => ({
          availabilityId: a.availabilityId,
          tenantId: a.tenantId,
          ownerType: a.ownerType,
          ownerId: a.ownerId,
          availabilityType: a.availabilityType,
          status: a.status,
          startDatetime: a.startDatetime.toISOString(),
          endDatetime: a.endDatetime.toISOString(),
          timezone: a.timezone,
          capacity: a.capacity,
          metadata: a.metadata,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      });
    } catch (error: any) {
      // 🔧 FIX: Log explícito do erro
      fastify.log.error({
        err: error,
        tenantId: req.tenant.id,
        userId: req.user?.userId,
        filters,
        message: 'Erro ao listar disponibilidades',
      }, 'Erro ao listar disponibilidades');
      
      return reply.status(error.statusCode || 500).send({ 
        error: error.message || 'Erro ao listar disponibilidades',
        ok: false,
      });
    }
  });

  /**
   * GET /availability/:id
   * Buscar disponibilidade por ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 canal-5 (:id recurso privado): `:id` é availabilityId, NÃO actor. Availability
    // operacional é PRIVADA → resolve o recurso e exige representar o DONO REAL (`availability.ownerId`)
    // ANTES de retornar. 401 sem user; 404 preservado se ausente; 403 fail-closed. `params.id` nunca como actor.
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }

    try {
      const availability = await unifiedAvailabilityService.getAvailability(
        req.tenant.id,
        req.params.id
      );

      // gate owner-scoped antes de devolver a PII da availability.
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, availability.ownerId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({
          ok: false,
          error: 'Sem autoridade sobre esta availability (representar o dono)',
          code: 'AVAILABILITY_NOT_REPRESENTABLE',
        });
      }

      return reply.send({
        ok: true,
        data: {
          availabilityId: availability.availabilityId,
          ownerType: availability.ownerType,
          ownerId: availability.ownerId,
          availabilityType: availability.availabilityType,
          status: availability.status,
          startDatetime: availability.startDatetime.toISOString(),
          endDatetime: availability.endDatetime.toISOString(),
          timezone: availability.timezone,
          capacity: availability.capacity,
          createdAt: availability.createdAt,
          updatedAt: availability.updatedAt,
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * PUT /availability/:id
   * Atualizar disponibilidade
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof updateAvailabilitySchema>;
  }>(
    '/:id',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 canal-5 (WRITE :id recurso privado): `:id` é availabilityId, NÃO actor. Alterar agenda
      // operacional exige representar o DONO REAL (resolvido da availability), não confiar em params/actionContext.
      // 401 sem user; 404 preservado; 403 fail-closed; autoria (actionContext) deve coincidir com o owner real.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = updateAvailabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // 🔴 CORE TEMPORAL: Bloquear schedule em metadata (violação do Core)
      if (parsed.data.metadata && typeof parsed.data.metadata === 'object') {
        if ('schedule' in parsed.data.metadata) {
          return reply.status(400).send({
            error: 'Invalid metadata',
            message: 'schedule não pode ser salvo em availability.metadata. AvailabilitySchedule é INPUT DECLARATIVO e não deve ser persistido como verdade temporal.',
          });
        }
      }

      try {
        // resolve o owner REAL da availability (404 preservado se ausente) e gateia ANTES de atualizar.
        const existing = await unifiedAvailabilityService.getAvailability(req.tenant.id, req.params.id);
        if (req.actionContext.actorId !== existing.ownerId) {
          return reply.status(403).send({
            ok: false,
            error: 'A autoria (actionContext) deve coincidir com o owner real da availability',
            code: 'AVAILABILITY_WRITE_OWNER_MISMATCH',
          });
        }
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, existing.ownerId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({
            ok: false,
            error: 'Sem autoridade sobre o owner da availability (canRepresentActor)',
            code: 'AVAILABILITY_WRITE_NOT_REPRESENTABLE',
          });
        }

        const updateData: any = { ...parsed.data };
        if (parsed.data.startDatetime) {
          updateData.startDatetime = new Date(parsed.data.startDatetime);
        }
        if (parsed.data.endDatetime) {
          updateData.endDatetime = new Date(parsed.data.endDatetime);
        }

        const availability = await unifiedAvailabilityService.updateAvailability(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          updateData
        );

        return reply.send({
          ok: true,
          data: {
            availabilityId: availability.availabilityId,
            tenantId: availability.tenantId,
            ownerType: availability.ownerType,
            ownerId: availability.ownerId,
            availabilityType: availability.availabilityType,
            status: availability.status,
            startDatetime: availability.startDatetime.toISOString(),
            endDatetime: availability.endDatetime.toISOString(),
            timezone: availability.timezone,
            capacity: availability.capacity,
            metadata: availability.metadata,
            createdAt: availability.createdAt,
            updatedAt: availability.updatedAt,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * PUT /availability/weekly-template
   * F1 (DECISION-0072 B1): materializa a grade semanal declarativa em janelas CONCRETAS no SSOT
   * `availability`. ownerId é SEMPRE o actor do contexto (actor-first) — cliente não escolhe owner.
   * 🔴 BLINDAGEM: grava só em `availability` (via service canônico). Sem schedules/schedule_slots,
   *    sem professional, sem metadata.schedule. Diff incremental booking-safe; retirada é soft.
   */
  fastify.put<{
    Body: z.infer<typeof weeklyTemplateSchema>;
  }>('/weekly-template', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 canal-1 (WRITE): `actionContext.actorId` é o owner/autoria DECLARADO da grade — é
    // client-declared (header/body/query), NÃO autoridade. Antes de materializar slots em `availability` para
    // esse actor, PROVAR server-side que o req.user pode representá-lo. 401 sem user; 403 fail-closed.
    // (`ownerId` continua = actionContext.actorId, mas agora PROVADO; o frontend legítimo manda o activeActor.)
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, req.actionContext.actorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({
        ok: false,
        error: 'Sem autoridade sobre o actor (canRepresentActor) — não pode materializar agenda deste actor',
        code: 'WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE',
      });
    }

    const parsed = weeklyTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const result = await weeklyTemplateMaterializerService.materialize(req.tenant.id, {
        schedule: parsed.data.schedule,
        timezone: parsed.data.timezone,
        horizonWeeks: parsed.data.horizonWeeks,
        ownerType: parsed.data.ownerType ?? AvailabilityOwnerType.USER,
        ownerId: req.actionContext.actorId, // actor-first: ownerId vem do contexto, nunca do cliente
      });
      return reply.status(200).send({ ok: true, data: result });
    } catch (error: any) {
      if (error instanceof BadRequestError) {
        return reply.status(400).send({ ok: false, error: error.message });
      }
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ ok: false, error: error.message });
    }
  });

  /**
   * POST /availability/bookings
   * Criar novo booking
   * 🔴 BLINDAGEM: availabilityId e requesterActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO executa pagamento
   */
  fastify.post<{
    Body: z.infer<typeof createBookingSchema>;
  }>(
    '/bookings',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 canal-1 (WRITE): `body.requesterActorId` é o solicitante DECLARADO da reserva —
      // client-declared, NÃO autoridade. Quem cria a reserva deve REPRESENTAR o requester. O owner da
      // availability PODE ser terceiro (cliente reserva slot de prestador) → NÃO se exige representar o owner.
      // 401 sem user; autoria (actionContext) deve coincidir com o requester (sem R2/delegação); 403 fail-closed.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = createBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // 🔴 gate: actionContext = requester (autoria coincide) + req.user representa o requester.
      if (req.actionContext.actorId !== parsed.data.requesterActorId) {
        return reply.status(403).send({
          ok: false,
          error: 'A autoria (actionContext) deve coincidir com o requester da reserva',
          code: 'BOOKING_CREATE_REQUESTER_MISMATCH',
        });
      }
      {
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, parsed.data.requesterActorId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({
            ok: false,
            error: 'Sem autoridade sobre o requester da reserva (canRepresentActor)',
            code: 'BOOKING_CREATE_REQUESTER_NOT_REPRESENTABLE',
          });
        }
      }

      try {
        const booking = await unifiedAvailabilityService.createBooking(
          req.tenant.id,
          req.actionContext.actorId,
          {
            availabilityId: parsed.data.availabilityId, // OBRIGATÓRIO
            requesterActorId: parsed.data.requesterActorId, // OBRIGATÓRIO
            notes: parsed.data.notes,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({
          bookingId: booking.bookingId,
          availabilityId: booking.availabilityId,
          requesterActorId: booking.requesterActorId,
          status: booking.status,
          requestedAt: booking.requestedAt.toISOString(),
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /availability/bookings
   * Listar bookings com filtros
   */
  fastify.get<{
    Querystring: {
      availabilityId?: string;
      requesterActorId?: string;
      status?: string;
    };
  }>('/bookings', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113: lista de bookings é escopada por PARTE REAL representável — NUNCA tenant-wide.
    // `requesterActorId`/`availabilityId` na query são HINT. Exigir representar o requester OU o dono real
    // da availability filtrada. Sem filtro de parte representável → 403 fail-closed (não lista o tenant).
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let scoped = false;
    if (req.query.requesterActorId) {
      try {
        if (await authorizationService.canRepresentActor(req.tenant.id, userId, req.query.requesterActorId)) scoped = true;
      } catch { /* fail-closed */ }
    }
    if (!scoped && req.query.availabilityId) {
      try {
        const availability = await unifiedAvailabilityService.getAvailability(req.tenant.id, req.query.availabilityId);
        if (availability?.ownerId && await authorizationService.canRepresentActor(req.tenant.id, userId, availability.ownerId)) {
          scoped = true;
        }
      } catch { /* availability ausente/erro → fail-closed */ }
    }
    if (!scoped) {
      return reply.status(403).send({
        ok: false,
        error: 'Listagem de bookings exige filtro por parte representável (requesterActorId que você representa, ou availabilityId cujo dono você representa)',
        code: 'BOOKING_LIST_SCOPE_REQUIRED',
      });
    }

    const filters: any = {};
    try {
      if (req.query.availabilityId) {
        filters.availabilityId = req.query.availabilityId;
      }
      if (req.query.requesterActorId) {
        filters.requesterActorId = req.query.requesterActorId;
      }
      if (req.query.status) {
        filters.status = req.query.status as UnifiedBookingStatus;
      }

      const bookings = await unifiedAvailabilityService.listBookings(
        req.tenant.id,
        filters
      );

      // 🔧 FIX: Sempre retornar array, mesmo se vazio
      return reply.send({
        ok: true,
        data: bookings.map(b => ({
          bookingId: b.bookingId,
          availabilityId: b.availabilityId,
          requesterActorId: b.requesterActorId,
          status: b.status,
          requestedAt: b.requestedAt.toISOString(),
          checkedInAt: b.checkedInAt?.toISOString(),
          checkedOutAt: b.checkedOutAt?.toISOString(),
        })),
      });
    } catch (error: any) {
      // 🔧 FIX: Log explícito do erro
      fastify.log.error({
        err: error,
        tenantId: req.tenant.id,
        userId: req.user?.userId,
        filters,
        message: 'Erro ao listar bookings',
      }, 'Erro ao listar bookings');
      
      return reply.status(error.statusCode || 500).send({ 
        error: error.message || 'Erro ao listar bookings',
        ok: false,
      });
    }
  });

  /**
   * GET /availability/bookings/:id
   * Buscar booking por ID
   */
  fastify.get<{ Params: { id: string } }>('/bookings/:id', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 canal-5 (:id recurso privado): `:id` é bookingId, NÃO actor. Booking = compromisso
    // privado entre requester e o dono da availability → resolver as PARTES reais e exigir representar UMA
    // delas ANTES de retornar. 401 sem user; 403 fail-closed. `params.id` nunca é tratado como actor.
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }

    try {
      const booking = await unifiedAvailabilityService.getBooking(
        req.tenant.id,
        req.params.id
      );

      // gate pelas partes reais (requester OU dono da availability) — antes de devolver a PII do booking.
      const canRead = await canReadBookingAsParty(req.tenant.id, userId, booking);
      if (!canRead) {
        return reply.status(403).send({
          ok: false,
          error: 'Sem autoridade sobre este booking (representar o solicitante ou o dono da availability)',
          code: 'BOOKING_NOT_REPRESENTABLE',
        });
      }

      return reply.send({
        ok: true,
        data: {
          bookingId: booking.bookingId,
          availabilityId: booking.availabilityId,
          requesterActorId: booking.requesterActorId,
          status: booking.status,
          requestedAt: booking.requestedAt.toISOString(),
          checkedInAt: booking.checkedInAt?.toISOString(),
          checkedOutAt: booking.checkedOutAt?.toISOString(),
          notes: booking.notes,
          createdAt: booking.createdAt,
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * PUT /availability/bookings/:id
   * Atualizar booking
   * 🔴 BLINDAGEM: NÃO executa pagamento
   */
  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof updateBookingSchema>;
  }>(
    '/bookings/:id',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 (WRITE) + matriz de autoridade por transição (decisão diretora): PUT NÃO é setter
      // genérico de status. SÓ aceita CONFIRM (owner) e CANCEL (requester|owner). Resolve as PARTES reais
      // (requester + dono da availability); req.user deve representar o actor atuante (actionContext); o ator
      // atuante deve ter o PAPEL da transição; o estado atual deve permitir. 401 sem user; 404 booking ausente;
      // 400 transição proibida; 403 papel errado; 409 estado inválido. params.id nunca como actor.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = updateBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // só CONFIRM/CANCEL via PUT (status arbitrário / pular check-in/out PROIBIDO)
      const target = parsed.data.status;
      if (target !== UnifiedBookingStatus.CONFIRMED && target !== UnifiedBookingStatus.CANCELLED) {
        return reply.status(400).send({
          ok: false,
          error: 'PUT /bookings/:id só aceita transição confirmed ou cancelled (status arbitrário proibido)',
          code: 'BOOKING_TRANSITION_NOT_ALLOWED',
        });
      }

      // o actor atuante (actionContext) deve ser representável pelo req.user
      let actingOk = false;
      try {
        actingOk = await authorizationService.canRepresentActor(req.tenant.id, userId, req.actionContext.actorId);
      } catch {
        actingOk = false;
      }
      if (!actingOk) {
        return reply.status(403).send({ ok: false, error: 'Sem autoridade sobre o actor atuante (canRepresentActor)', code: 'BOOKING_ACTING_ACTOR_NOT_REPRESENTABLE' });
      }

      try {
        // resolve as partes reais (404 booking ausente preservado).
        const existing = await unifiedAvailabilityService.getBooking(req.tenant.id, req.params.id);
        const availability = await unifiedAvailabilityService.getAvailability(req.tenant.id, existing.availabilityId);
        const ownerId = availability.ownerId;
        const requesterId = existing.requesterActorId;

        if (target === UnifiedBookingStatus.CONFIRMED) {
          // confirmar = SÓ owner, e SÓ a partir de requested.
          if (req.actionContext.actorId !== ownerId) {
            return reply.status(403).send({ ok: false, error: 'Confirmar booking exige ser o dono da availability', code: 'BOOKING_CONFIRM_OWNER_ONLY' });
          }
          if (existing.status !== UnifiedBookingStatus.REQUESTED) {
            return reply.status(409).send({ ok: false, error: 'Só é possível confirmar um booking em estado requested', code: 'BOOKING_CONFIRM_INVALID_STATE' });
          }
        } else {
          // cancelar = requester OU owner; nunca depois de checked_out.
          if (req.actionContext.actorId !== requesterId && req.actionContext.actorId !== ownerId) {
            return reply.status(403).send({ ok: false, error: 'Cancelar booking exige ser o requester ou o dono da availability', code: 'BOOKING_CANCEL_PARTY_ONLY' });
          }
          if (existing.status === UnifiedBookingStatus.CHECKED_OUT) {
            return reply.status(409).send({ ok: false, error: 'Não é possível cancelar um booking já finalizado (checked_out)', code: 'BOOKING_CANCEL_INVALID_STATE' });
          }
        }

        const booking = await unifiedAvailabilityService.updateBooking(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          parsed.data
        );

        return reply.send({
          bookingId: booking.bookingId,
          status: booking.status,
          confirmedAt: booking.confirmedAt?.toISOString(),
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /availability/bookings/:id/check-in
   * Realizar check-in
   * 🔴 BLINDAGEM: Check-in é apenas registro, NÃO executa pagamento
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof checkInSchema>;
  }>(
    '/bookings/:id/check-in',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 (WRITE) — matriz diretora: CHECK-IN = SÓ o dono da availability. Resolve o booking +
      // owner real; actionContext deve === ownerId E req.user representa o owner. 401/403; 404 preservado.
      // Pré-condição de estado (status=CONFIRMED) preservada no service. params.id nunca como actor.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = checkInSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const existing = await unifiedAvailabilityService.getBooking(req.tenant.id, req.params.id);
        const availability = await unifiedAvailabilityService.getAvailability(req.tenant.id, existing.availabilityId);
        if (req.actionContext.actorId !== availability.ownerId) {
          return reply.status(403).send({ ok: false, error: 'Check-in exige ser o dono da availability', code: 'BOOKING_CHECKIN_OWNER_ONLY' });
        }
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, availability.ownerId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({ ok: false, error: 'Sem autoridade sobre o dono da availability (canRepresentActor)', code: 'BOOKING_CHECKIN_NOT_REPRESENTABLE' });
        }

        const booking = await unifiedAvailabilityService.checkIn(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          parsed.data
        );

        return reply.send({
          bookingId: booking.bookingId,
          status: booking.status,
          checkedInAt: booking.checkedInAt?.toISOString(),
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /availability/bookings/:id/check-out
   * Realizar check-out
   * 🔴 BLINDAGEM: Check-out é apenas registro, NÃO executa pagamento
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof checkOutSchema>;
  }>(
    '/bookings/:id/check-out',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 (WRITE) — matriz diretora: CHECK-OUT = SÓ o dono da availability. Resolve o booking +
      // owner real; actionContext deve === ownerId E req.user representa o owner. 401/403; 404 preservado.
      // Pré-condição de estado (checkedInAt) preservada no service. params.id nunca como actor.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      // Validar payload
      const parsed = checkOutSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const existing = await unifiedAvailabilityService.getBooking(req.tenant.id, req.params.id);
        const availability = await unifiedAvailabilityService.getAvailability(req.tenant.id, existing.availabilityId);
        if (req.actionContext.actorId !== availability.ownerId) {
          return reply.status(403).send({ ok: false, error: 'Check-out exige ser o dono da availability', code: 'BOOKING_CHECKOUT_OWNER_ONLY' });
        }
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, availability.ownerId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({ ok: false, error: 'Sem autoridade sobre o dono da availability (canRepresentActor)', code: 'BOOKING_CHECKOUT_NOT_REPRESENTABLE' });
        }

        const booking = await unifiedAvailabilityService.checkOut(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          parsed.data
        );

        return reply.send({
          bookingId: booking.bookingId,
          status: booking.status,
          checkedOutAt: booking.checkedOutAt?.toISOString(),
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /availability/:availabilityId/participants
   * Adicionar participante a uma availability
   * 🔴 BLINDAGEM: availabilityId e actorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO bloqueia automaticamente conflitos
   * Retorna ALERTA se houver conflitos, mas não bloqueia
   */
  const createParticipantSchema = z.object({
    actorId: z.string().uuid(), // OBRIGATÓRIO
    role: z.nativeEnum(ParticipantRole).optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.post<{
    Params: { availabilityId: string };
    Body: z.infer<typeof createParticipantSchema>;
  }>(
    '/:availabilityId/participants',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = createParticipantSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        // 🔴 BLINDAGEM: Criar participante (NÃO bloqueia conflitos)
        const participant = await unifiedAvailabilityService.createParticipant(
          req.tenant.id,
          req.actionContext.actorId,
          {
            availabilityId: req.params.availabilityId, // OBRIGATÓRIO
            actorId: parsed.data.actorId, // OBRIGATÓRIO
            role: parsed.data.role,
            metadata: parsed.data.metadata,
          }
        );

        // 🔴 BLINDAGEM: Detectar conflitos (apenas informação, não decisão)
        // Retorna ALERTA, não bloqueio
        const conflictDetection = await unifiedAvailabilityService.detectConflicts(
          req.tenant.id,
          req.params.availabilityId,
          parsed.data.actorId
        );

        return reply.status(201).send({
          participant: {
            participantId: participant.participantId,
            availabilityId: participant.availabilityId,
            actorId: participant.actorId,
            role: participant.role,
            createdAt: participant.createdAt,
          },
          // 🔴 BLINDAGEM: Conflitos são ALERTA, não bloqueio
          // A confirmação cabe ao usuário
          conflictAlert: conflictDetection.hasConflicts ? {
            hasConflicts: true,
            conflicts: conflictDetection.conflicts.map(c => ({
              conflictAvailabilityId: c.conflictAvailabilityId,
              conflictStartDatetime: c.conflictStartDatetime.toISOString(),
              conflictEndDatetime: c.conflictEndDatetime.toISOString(),
              conflictOwnerType: c.conflictOwnerType,
              conflictOwnerId: c.conflictOwnerId,
            })),
            message: conflictDetection.message,
          } : null,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /availability/:availabilityId/participants
   * Listar participantes de uma availability
   */
  fastify.get<{
    Params: { availabilityId: string };
    Querystring: {
      role?: string;
    };
  }>('/:availabilityId/participants', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 + decisão diretora: lista de participantes = PII relacional PRIVADA → OWNER-ONLY.
    // Resolve a availability por `params.availabilityId` (404 preservado se ausente) e exige representar o
    // DONO REAL antes de listar (`actionContext`/`availabilityId` declarados são hint). 401 sem user;
    // 403 fail-closed. (Visão de co-participante, se um dia desejada, é projeção/endpoint próprio — não aqui.)
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }

    try {
      const availability = await unifiedAvailabilityService.getAvailability(
        req.tenant.id,
        req.params.availabilityId
      );
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, availability.ownerId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({
          ok: false,
          error: 'Sem autoridade sobre os participantes (representar o dono da availability)',
          code: 'PARTICIPANTS_NOT_REPRESENTABLE',
        });
      }

      const filters: any = {
        availabilityId: req.params.availabilityId,
      };
      if (req.query.role) {
        filters.role = req.query.role as ParticipantRole;
      }

      const participants = await unifiedAvailabilityService.listParticipants(
        req.tenant.id,
        filters
      );

      // 🔧 FIX: Sempre retornar array, mesmo se vazio
      return reply.send({
        ok: true,
        data: participants.map(p => ({
          participantId: p.participantId,
          availabilityId: p.availabilityId,
          actorId: p.actorId,
          role: p.role,
          createdAt: p.createdAt,
        })),
      });
    } catch (error: any) {
      // 🔧 FIX: Log explícito do erro
      fastify.log.error({
        err: error,
        tenantId: req.tenant.id,
        userId: req.user?.userId,
        availabilityId: req.params.availabilityId,
        message: 'Erro ao listar participantes',
      }, 'Erro ao listar participantes');
      
      return reply.status(error.statusCode || 500).send({ 
        error: error.message || 'Erro ao listar participantes',
        ok: false,
      });
    }
  });

  /**
   * GET /availability/participants/:id
   * Buscar participante por ID
   */
  fastify.get<{ Params: { id: string } }>('/participants/:id', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 canal-5 (:id recurso privado): `:id` é participantId, NÃO actor. Participant = PII
    // relacional → resolve o participante e exige OWNER-OR-SELF: representar o próprio `participant.actorId`
    // OU o DONO real da availability. 401 sem user; 403 fail-closed. `params.id` nunca tratado como actor.
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }

    try {
      const participant = await unifiedAvailabilityService.getParticipant(
        req.tenant.id,
        req.params.id
      );

      // gate owner-or-self antes de devolver a PII do participant.
      const canRead = await canReadParticipantAsParty(req.tenant.id, userId, participant);
      if (!canRead) {
        return reply.status(403).send({
          ok: false,
          error: 'Sem autoridade sobre este participante (representar o próprio participante ou o dono da availability)',
          code: 'PARTICIPANT_NOT_REPRESENTABLE',
        });
      }

      return reply.send({
        ok: true,
        data: {
          participantId: participant.participantId,
          availabilityId: participant.availabilityId,
          actorId: participant.actorId,
          role: participant.role,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * PUT /availability/participants/:id
   * Atualizar participante
   */
  const updateParticipantSchema = z.object({
    role: z.nativeEnum(ParticipantRole).optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof updateParticipantSchema>;
  }>(
    '/participants/:id',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = updateParticipantSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const participant = await unifiedAvailabilityService.updateParticipant(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          parsed.data
        );

        return reply.send({
          participantId: participant.participantId,
          role: participant.role,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

  /**
   * DELETE /availability/participants/:id
   * Remover participante
   */
  fastify.delete<{ Params: { id: string } }>('/participants/:id', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      await unifiedAvailabilityService.deleteParticipant(
        req.tenant.id,
        req.params.id,
        req.actionContext.actorId
      );

      return reply.status(204).send();
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * GET /availability/:availabilityId/participants/:actorId/conflicts
   * Detectar conflitos de horário para um participante
   * 🔴 BLINDAGEM: Esta função DETECTA conflitos, NÃO bloqueia
   * 🔴 BLINDAGEM: A confirmação cabe ao usuário
   * Retorna ALERTA, não bloqueio
   */
  fastify.get<{
    Params: { availabilityId: string; actorId: string };
  }>('/:availabilityId/participants/:actorId/conflicts', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 canal-5 (params): `:actorId` é o SUJEITO da consulta de conflitos — retorna a agenda
    // (slots/horários) do actor alvo = PII operacional. `actionContext`/`tenant` só provam presença, NÃO
    // representabilidade. `req.params.actorId` é HINT, não autoridade. Exigir que o req.user PROVE representar
    // esse actorId ANTES de detectConflicts (fail-closed → 403). 401 sem user. O gate bate no MESMO actorId
    // que dirige a leitura, não no actor do caller.
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, req.params.actorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({
        error: 'Sem autoridade sobre o actor (canRepresentActor)',
        code: 'AVAILABILITY_CONFLICTS_ACTOR_NOT_REPRESENTABLE',
      });
    }

    try {
      // 🔴 BLINDAGEM: Detectar conflitos (apenas informação, não decisão)
      // Retorna ALERTA, não bloqueio
      const conflictDetection = await unifiedAvailabilityService.detectConflicts(
        req.tenant.id,
        req.params.availabilityId,
        req.params.actorId
      );

      return reply.send({
        ok: true,
        data: {
          hasConflicts: conflictDetection.hasConflicts,
          conflicts: conflictDetection.conflicts.map(c => ({
            conflictAvailabilityId: c.conflictAvailabilityId,
            conflictStartDatetime: c.conflictStartDatetime.toISOString(),
            conflictEndDatetime: c.conflictEndDatetime.toISOString(),
            conflictOwnerType: c.conflictOwnerType,
            conflictOwnerId: c.conflictOwnerId,
          })),
          message: conflictDetection.message,
        },
        // 🔴 BLINDAGEM: Conflitos são ALERTA, não bloqueio
        // A confirmação cabe ao usuário
        alert: conflictDetection.hasConflicts
          ? 'Foram detectados conflitos de horário. A confirmação cabe ao usuário.'
          : null,
      });
    } catch (error: any) {
      // 🔧 FIX: Log explícito do erro
      fastify.log.error({
        err: error,
        tenantId: req.tenant.id,
        userId: req.user?.userId,
        availabilityId: req.params.availabilityId,
        actorId: req.params.actorId,
        message: 'Erro ao detectar conflitos',
      }, 'Erro ao detectar conflitos');
      
      return reply.status(error.statusCode || 500).send({ 
        error: error.message || 'Erro ao detectar conflitos',
        ok: false,
      });
    }
  });
};

export { unifiedAvailabilityRoutes };

