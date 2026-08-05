// src/modules/cultural/cultural.routes.ts
// Rotas para Cultura & Eventos - FASE 16
// Perfis de Atuação Cultural (PAC) e Eventos Culturais

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { culturalProfileService } from './cultural-profile.service';
import { culturalEventService, type CreateCulturalEventInput } from './cultural-event.service';
import { ensureUserActor } from '@modules/identity';

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
          severity: 'INFO',
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

      // 🔴 DECISION-0113 canal 3 (cultural privado): `owner_actor_id` da query é HINT, não autoridade. Os
      // perfis culturais (PACs) são do DONO ("do ator ativo") → o `req.user` precisa poder REPRESENTAR esse
      // owner antes de listar. fail-closed → 401 (sem caller) / 403 (não representável) não-leak.
      const callerUserId = (req as { user?: { userId?: string } }).user?.userId;
      if (!callerUserId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      let canRepresentOwner = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canRepresentOwner = await authorizationService.canRepresentActor(req.tenant.id, callerUserId, ownerActorId);
      } catch {
        canRepresentOwner = false;
      }
      if (!canRepresentOwner) {
        return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
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
        validated as CreateCulturalEventInput
      );

      // FASE 13: Registrar evento de auditoria (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.record(req.tenant.id, {
          event_type: 'EVENT_CREATED',
          severity: 'INFO',
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
          severity: 'INFO',
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
          severity: 'INFO',
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
    // 🔴 NUNCA quebrar o feed - sempre retornar 200 com payload vazio se houver problema
    if (!req.user) {
      fastify.log.debug('Usuário não autenticado em /cultural/events - retornando lista vazia');
      return reply.send({ events: [], next_cursor: null });
    }

    if (!req.tenant) {
      fastify.log.debug('Tenant não encontrado em /cultural/events - retornando lista vazia');
      return reply.send({ events: [], next_cursor: null });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const cursor = req.query.cursor;

      const result = await culturalEventService.listPublicEvents(
        req.tenant.id,
        limit,
        cursor
      );

      // ✅ Sempre retornar 200, mesmo se não houver eventos (não é erro)
      return reply.send(result || { events: [], next_cursor: null });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar eventos culturais');
      // 🔴 CONTINUA 200 — não quebrar o feed segue valendo. O que muda é PARAR DE AFIRMAR VAZIO.
      //
      // `cultural_events` NÃO EXISTE no banco (medido 2026-08-05: relação não existe). Logo TODA
      // chamada caía aqui e o cliente recebia `events: []` — que não é "deu erro", é a afirmação
      // **"não há eventos culturais"**. A tela então mostra uma seção vazia, para sempre, e nem o
      // usuário nem o operador tem como saber que a seção está QUEBRADA e não apenas sem conteúdo.
      // Zero é uma afirmação; desconhecido é a verdade — e desconhecido tem que aparecer.
      //
      // `unavailable` é campo NOVO e opcional: quem já consome `events`/`next_cursor` não muda.
      // Quem quiser distinguir agora consegue — e o frontend já tem o conceito de feature
      // indisponível (`FEATURE_UNAVAILABLE` em `api/cultural.ts`), que até hoje só era alcançável
      // por 404 e por isso nunca disparava.
      return reply.send({ events: [], next_cursor: null, unavailable: true });
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
      // Resolve actor_id real via identity service (C50 fix)
      const actor = await ensureUserActor(req.tenant.id, req.user.id);
      const actorId = req.body.target_actor_id || actor.actor_id;

      // 🔴 F-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-DERIVED (DT-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-SELF-
      // DIVERGENCE): actor_type é SEMPRE derivado SERVER-SIDE do actor real, nunca do body. Antes,
      // `req.body.target_actor_type` era usado sem validar coerência com o actor_id resolvido — com
      // target=self (ou omitido), permitia gravar `actor_id` correto (o próprio caller) porém
      // `actor_type` divergente (ex.: 'page'); como a UNIQUE é (tenant,event,actor_id,actor_type), o
      // mesmo actor "dobrava" presença sob tipos distintos. NÃO é brecha de autoridade (actor_id já
      // era sempre correto) — é integridade de dado/read-model. Mesma derivação cobre também o caso
      // representável (actorId !== actor.actor_id): o tipo vem do actor-alvo REAL, não do que o
      // cliente declarou. 404 honesto se o actor-alvo declarado não existir (antes seguiria com um
      // actor_type arbitrário para um actor_id potencialmente inexistente).
      let actorType: 'user' | 'page' | 'cultural_profile';
      if (actorId === actor.actor_id) {
        actorType = (actor.actor_type as 'user' | 'page' | 'cultural_profile') || 'user';
      } else {
        const { socialPortsRegistry } = await import('@core/social/ports-registry');
        const targetActor = await socialPortsRegistry.getActorRepository().findById(req.tenant.id, actorId);
        if (!targetActor) {
          return reply.status(404).send({
            error: 'Actor-alvo do check-in não encontrado',
            code: 'CULTURAL_CHECKIN_TARGET_NOT_FOUND',
          });
        }
        actorType = targetActor.actor_type as 'user' | 'page' | 'cultural_profile';
      }

      // 🔴 F-CULTURAL-CHECKIN-TARGET-AUTHORITY-BINDING-SLICE-A (DECISION-0113 residual · authority · money-free):
      // AUTO/QR_CODE NÃO podem gravar presença em nome de actor alheio declarado no body (target_actor_id é
      // HINT/target, NUNCA autoridade). Política: self permitido; actor representável permitido
      // (canRepresentActor resolvido SERVER-SIDE a partir de req.user.id); alheio não representável → 403
      // fail-closed ANTES de qualquer escrita em cultural_event_checkins. MANUAL é preservado: o gate de
      // validador/portaria (canValidateCheckIn) vive no service e continua sendo a autoridade daquele fluxo.
      if (
        (req.body.method === 'AUTO' || req.body.method === 'QR_CODE') &&
        actorId !== actor.actor_id
      ) {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        const canRepresent = await authorizationService.canRepresentActor(req.tenant.id, req.user.id, actorId);
        if (!canRepresent) {
          return reply.status(403).send({
            error: 'Sem autoridade para fazer check-in em nome do actor declarado',
            code: 'CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE',
          });
        }
      }

      const result = await culturalEventService.checkIn(
        req.tenant.id,
        req.params.eventId,
        {
          actor_id: actorId,
          actor_type: actorType,
          method: req.body.method,
          qr_code: req.body.qr_code,
          checked_in_by_actor_id: req.body.method === 'MANUAL' ? actor.actor_id : undefined,
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

