// src/modules/cultural/cultural.routes.ts
// Rotas para Cultura & Eventos - FASE 16
// Perfis de Atuação Cultural (PAC) e Eventos Culturais

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { culturalProfileService } from './cultural-profile.service';
import { culturalEventService } from './cultural-event.service';

const createProfileSchema = z.object({
  owner_actor_id: z.string().uuid(),
  owner_actor_type: z.enum(['user', 'page']),
  type: z.enum(['ARTIST', 'BAND', 'BAR', 'VENUE', 'COLLECTIVE', 'PRODUCER', 'CIRCLE', 'EDUCATOR', 'CURATOR']),
  display_name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  linked_company_id: z.string().uuid().optional(),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
});

const createEventSchema = z.object({
  created_by_cultural_profile_id: z.string().uuid(),
  co_creators_cultural_profile_ids: z.array(z.string().uuid()).optional(),
  event_type: z.enum(['SHOW', 'OFICINA', 'FESTIVAL', 'RODA', 'AULA', 'EXPOSICAO', 'DEBATE', 'INTERVENCAO']),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  datetime_start: z.string().datetime(),
  datetime_end: z.string().datetime(),
  location_cultural_profile_id: z.string().uuid().optional(),
  visibility: z.enum(['PUBLIC', 'LOCAL', 'PRIVATE']).optional(),
  ticket_price_cents: z.number().int().positive().optional(),
  max_attendees: z.number().int().positive().optional(),
  revenue_split: z.array(z.object({
    target_type: z.enum(['CULTURAL_PROFILE', 'REGION', 'FUND']),
    target_id: z.string(),
    percentage: z.number().int().min(0).max(100),
  })).min(1),
});

const culturalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /cultural/profiles
   * Cria um novo Perfil de Atuação Cultural (PAC)
   * FASE 16: Cultura & Eventos
   */
  fastify.post<{
    Body: z.infer<typeof createProfileSchema>;
  }>('/profiles', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = createProfileSchema.parse(req.body);
      const profile = await culturalProfileService.createProfile(
        req.tenant.id,
        validated
      );

      // FASE 13: Registrar evento de auditoria (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.record(req.tenant.id, {
          event_type: 'CULTURAL_PROFILE_CREATED',
          severity: 'LOW',
          actor_id: validated.owner_actor_id,
          actor_type: validated.owner_actor_type,
          source: 'social',
          context: {
            profile_id: profile.id,
            profile_type: validated.type,
            slug: validated.slug,
          },
        });
      } catch (err) {
        console.warn('Erro ao registrar auditoria de PAC (não crítico):', err);
      }

      return reply.status(201).send(profile);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao criar perfil cultural');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao criar perfil cultural',
      });
    }
  });

  /**
   * GET /cultural/profiles
   * Lista PACs do ator ativo
   * FASE 16: Cultura & Eventos
   */
  fastify.get<{
    Querystring: {
      owner_actor_id: string;
      owner_actor_type: 'user' | 'page';
    };
  }>('/profiles', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const ownerActorId = req.query.owner_actor_id;
      const ownerActorType = req.query.owner_actor_type;

      if (!ownerActorId || !ownerActorType) {
        return reply.status(400).send({
          error: 'owner_actor_id e owner_actor_type são obrigatórios',
        });
      }

      const profiles = await culturalProfileService.listProfilesByActor(
        req.tenant.id,
        ownerActorId,
        ownerActorType
      );

      return reply.send({ profiles });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar perfis culturais');
      return reply.status(500).send({
        error: 'Erro ao listar perfis culturais',
      });
    }
  });

  /**
   * GET /cultural/profiles/:id
   * Busca PAC por ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/profiles/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const profile = await culturalProfileService.getProfile(
        req.tenant.id,
        req.params.id
      );

      if (!profile) {
        return reply.status(404).send({ error: 'Perfil cultural não encontrado' });
      }

      return reply.send(profile);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar perfil cultural');
      return reply.status(500).send({
        error: 'Erro ao buscar perfil cultural',
      });
    }
  });

  /**
   * POST /cultural/events
   * Cria evento cultural (DRAFT)
   * FASE 16: Cultura & Eventos
   */
  fastify.post<{
    Body: z.infer<typeof createEventSchema>;
  }>('/events', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = createEventSchema.parse(req.body);
      const event = await culturalEventService.createEvent(
        req.tenant.id,
        validated
      );

      // FASE 13: Registrar evento de auditoria (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.record(req.tenant.id, {
          event_type: 'EVENT_CREATED',
          severity: 'LOW',
          source: 'social',
          context: {
            event_id: event.id,
            event_type: validated.event_type,
            cultural_profile_id: validated.created_by_cultural_profile_id,
          },
        });
      } catch (err) {
        console.warn('Erro ao registrar auditoria de evento (não crítico):', err);
      }

      return reply.status(201).send(event);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao criar evento cultural');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao criar evento cultural',
      });
    }
  });

  /**
   * POST /cultural/events/:id/publish
   * Publica evento (DRAFT → PUBLISHED)
   */
  fastify.post<{
    Params: { id: string };
  }>('/events/:id/publish', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const event = await culturalEventService.publishEvent(
        req.tenant.id,
        req.params.id
      );

      // FASE 13: Registrar evento de auditoria (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.record(req.tenant.id, {
          event_type: 'EVENT_PUBLISHED',
          severity: 'LOW',
          source: 'social',
          context: {
            event_id: event.id,
            event_type: event.event_type,
            cultural_profile_id: event.created_by_cultural_profile_id,
          },
        });
      } catch (err) {
        console.warn('Erro ao registrar auditoria de publicação (não crítico):', err);
      }

      return reply.send(event);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao publicar evento');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao publicar evento',
      });
    }
  });

  /**
   * POST /cultural/events/:id/confirm-location
   * Local confirma evento (PUBLISHED → CONFIRMED)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      location_cultural_profile_id: string;
    };
  }>('/events/:id/confirm-location', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const event = await culturalEventService.confirmLocation(
        req.tenant.id,
        req.params.id,
        req.body.location_cultural_profile_id
      );

      // FASE 13: Registrar evento de auditoria (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.record(req.tenant.id, {
          event_type: 'EVENT_LOCATION_CONFIRMED',
          severity: 'LOW',
          source: 'social',
          context: {
            event_id: event.id,
            location_cultural_profile_id: req.body.location_cultural_profile_id,
          },
        });
      } catch (err) {
        console.warn('Erro ao registrar auditoria de confirmação (não crítico):', err);
      }

      return reply.send(event);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao confirmar local');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao confirmar local',
      });
    }
  });

  /**
   * POST /cultural/events/:id/complete
   * Completa evento (CONFIRMED → COMPLETED)
   */
  fastify.post<{
    Params: { id: string };
  }>('/events/:id/complete', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const event = await culturalEventService.completeEvent(
        req.tenant.id,
        req.params.id
      );

      return reply.send(event);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao completar evento');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao completar evento',
      });
    }
  });

  /**
   * GET /cultural/events/:id
   * Busca evento por ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/events/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const event = await culturalEventService.getEvent(
        req.tenant.id,
        req.params.id
      );

      if (!event) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      // Buscar split de receita
      const revenueSplit = await culturalEventService.getEventRevenueSplit(
        req.tenant.id,
        req.params.id
      );

      return reply.send({
        ...event,
        revenue_split: revenueSplit,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar evento');
      return reply.status(500).send({
        error: 'Erro ao buscar evento',
      });
    }
  });

  /**
   * GET /cultural/events
   * Lista eventos públicos
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
    };
  }>('/events', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const cursor = req.query.cursor;

      const result = await culturalEventService.listPublicEvents(
        req.tenant.id,
        limit,
        cursor
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar eventos');
      return reply.status(500).send({
        error: 'Erro ao listar eventos',
      });
    }
  });

  /**
   * GET /cultural/events/:eventId/check-in/qr
   * FASE 17: Gera QR code de check-in para evento
   */
  fastify.get<{
    Params: { eventId: string };
  }>('/events/:eventId/check-in/qr', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const result = await culturalEventService.generateCheckInQR(
        req.tenant.id,
        req.params.eventId
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao gerar QR code de check-in');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao gerar QR code',
      });
    }
  });

  /**
   * POST /cultural/events/:eventId/check-in
   * FASE 17: Realiza check-in em evento cultural
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      method: 'QR_CODE' | 'MANUAL' | 'AUTO';
      qr_code?: string;
      target_actor_id?: string;
      target_actor_type?: 'user' | 'page' | 'cultural_profile';
      geo?: { lat: number; lng: number };
      device_fingerprint?: string;
      metadata?: Record<string, any>;
    };
  }>('/events/:eventId/check-in', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // Determinar actor_id e actor_type
      // Por enquanto, usar globalUserId como actor_id e 'user' como tipo
      // TODO: Suportar ator ativo (PF/PJ/PAC) quando implementado
      const actorId = req.body.target_actor_id || req.user.globalUserId;
      const actorType = req.body.target_actor_type || 'user';

      const result = await culturalEventService.checkIn(
        req.tenant.id,
        req.params.eventId,
        {
          actor_id: actorId,
          actor_type: actorType,
          method: req.body.method,
          qr_code: req.body.qr_code,
          checked_in_by_actor_id: req.body.method === 'MANUAL' ? req.user.globalUserId : undefined,
          checked_in_by_actor_type: req.body.method === 'MANUAL' ? 'user' : undefined,
          geo: req.body.geo,
          device_fingerprint: req.body.device_fingerprint,
          metadata: req.body.metadata,
        }
      );

      return reply.status(200).send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao fazer check-in');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao fazer check-in',
      });
    }
  });

  /**
   * GET /cultural/events/:eventId/check-ins
   * FASE 17: Lista check-ins de um evento
   */
  fastify.get<{
    Params: { eventId: string };
    Querystring: {
      limit?: string;
      cursor?: string;
    };
  }>('/events/:eventId/check-ins', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const cursor = req.query.cursor;

      const result = await culturalEventService.listCheckIns(
        req.tenant.id,
        req.params.eventId,
        {
          limit,
          cursor,
          requesterActorId: req.user.globalUserId,
          requesterActorType: 'user', // TODO: Suportar ator ativo
        }
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar check-ins');
      return reply.status(500).send({
        error: 'Erro ao listar check-ins',
      });
    }
  });

  /**
   * GET /cultural/events/:eventId/checkins/count
   * EVENTOS ÂNCORA: Conta check-ins de um evento (leve, para eventos grandes)
   */
  fastify.get<{
    Params: { eventId: string };
  }>('/events/:eventId/checkins/count', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const count = await culturalEventService.getCheckInCount(
        req.tenant.id,
        req.params.eventId
      );

      return reply.send({ count });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao contar check-ins');
      return reply.status(500).send({
        error: 'Erro ao contar check-ins',
      });
    }
  });

  /**
   * GET /cultural/events/:eventId/check-in/status
   * FASE 17: Verifica status de check-in do usuário atual
   */
  fastify.get<{
    Params: { eventId: string };
  }>('/events/:eventId/check-in/status', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const result = await culturalEventService.getCheckInStatus(
        req.tenant.id,
        req.params.eventId,
        req.user.globalUserId,
        'user' // TODO: Suportar ator ativo
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao verificar status de check-in');
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao verificar status',
      });
    }
  });
};

export default culturalRoutes;

