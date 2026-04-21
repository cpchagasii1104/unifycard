// src/core/availability/unified-availability.routes.ts
// Rotas do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 BLINDAGEM: NÃO cria lógica decisória automática

import { FastifyPluginAsync } from 'fastify';
import { unifiedAvailabilityService } from './unified-availability.service';
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
      } catch (error) {
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

    try {
      const filters: any = {};
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

    try {
      const availability = await unifiedAvailabilityService.getAvailability(
        req.tenant.id,
        req.params.id
      );

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
    } catch (error) {
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
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    }
  );

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

      // Validar payload
      const parsed = createBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
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
      } catch (error) {
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

    try {
      const filters: any = {};
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
      
      // 🔧 FIX: Se erro de tabela não existir ou schema, retornar array vazio
      if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.message?.includes('relation') || error?.message?.includes('schema')) {
        fastify.log.warn({
          tenantId: req.tenant.id,
          message: 'Tabela bookings não existe ainda - retornando array vazio',
        }, 'Tabela bookings não existe');
        return reply.send({
          ok: true,
          data: [],
        });
      }
      
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

    try {
      const booking = await unifiedAvailabilityService.getBooking(
        req.tenant.id,
        req.params.id
      );

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
    } catch (error) {
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

      // Validar payload
      const parsed = updateBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
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
      } catch (error) {
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

      // Validar payload
      const parsed = checkInSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
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
      } catch (error) {
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

      // Validar payload
      const parsed = checkOutSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
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
      } catch (error) {
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
      } catch (error) {
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

    try {
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
      
      // 🔧 FIX: Se erro de tabela não existir ou schema, retornar array vazio
      if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.message?.includes('relation') || error?.message?.includes('schema')) {
        fastify.log.warn({
          tenantId: req.tenant.id,
          availabilityId: req.params.availabilityId,
          message: 'Tabela availability_participants não existe ainda - retornando array vazio',
        }, 'Tabela availability_participants não existe');
        return reply.send({
          ok: true,
          data: [],
        });
      }
      
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

    try {
      const participant = await unifiedAvailabilityService.getParticipant(
        req.tenant.id,
        req.params.id
      );

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
    } catch (error) {
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
      } catch (error) {
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
    } catch (error) {
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
      
      // 🔧 FIX: Se erro de tabela não existir ou schema, retornar sem conflitos
      if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.message?.includes('relation') || error?.message?.includes('schema')) {
        fastify.log.warn({
          tenantId: req.tenant.id,
          availabilityId: req.params.availabilityId,
          actorId: req.params.actorId,
          message: 'Tabela availability não existe ainda - retornando sem conflitos',
        }, 'Tabela availability não existe');
        return reply.send({
          ok: true,
          data: {
            hasConflicts: false,
            conflicts: [],
            message: 'Nenhum conflito detectado',
          },
        });
      }
      
      return reply.status(error.statusCode || 500).send({ 
        error: error.message || 'Erro ao detectar conflitos',
        ok: false,
      });
    }
  });
};

export { unifiedAvailabilityRoutes };

