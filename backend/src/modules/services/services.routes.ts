// src/modules/services/services.routes.ts
// Rotas do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura, listagem por actor)

import { FastifyPluginAsync } from 'fastify';
import { servicesService } from './services.service';
import { z } from 'zod';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { authorizationService } from '@core/authorization/authorization.service';

const createServiceSchema = z.object({
  actorId: z.string().uuid(), // OBRIGATÓRIO
  name: z.string().min(1).max(255),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  serviceType: z.enum(['service', 'rental', 'event', 'job']).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  // DECISION-0117 D: identidade canônica compartilhada (obrigatória p/ service_type='service' — validada no service)
  canonicalServiceId: z.string().uuid().nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().optional(),
  pricingType: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'fixed', 'quote']).nullable().optional(),
  countryId: z.string().uuid().nullable().optional(),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  serviceType: z.enum(['service', 'rental', 'event', 'job']).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().optional(),
  pricingType: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'fixed', 'quote']).nullable().optional(),
  countryId: z.string().uuid().nullable().optional(),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const servicesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /services
   * Criar novo serviço
   * 🔴 BLINDAGEM: actorId é OBRIGATÓRIO
   */
  fastify.post<{ Body: z.infer<typeof createServiceSchema> }>(
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
      const parsed = createServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // 🔴 DECISION-0113 / DECISION-0131 §B7 / Z2-R6.1 — `body.actorId` é HINT (dono declarado do
      // serviço), nunca autoridade. O principal autenticado (req.user.userId, server-side) DEVE provar
      // representação do actor dono via canRepresentActor (fail-closed → 403) ANTES de criar o serviço.
      // Existência do actor (validada no service) NÃO prova representação.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Autenticação obrigatória (req.user.userId)' });
      }
      const canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, parsed.data.actorId);
      if (!canRep) {
        return reply.status(403).send({ ok: false, code: 'SERVICE_ACTOR_NOT_REPRESENTABLE', error: 'Sem autoridade para criar serviço em nome do actor declarado (canRepresentActor)' });
      }

      try {
        const service = await servicesService.createService(
          req.tenant.id,
          userId,
          {
            actorId: parsed.data.actorId, // OBRIGATÓRIO
            name: parsed.data.name,
            slug: parsed.data.slug,
            description: parsed.data.description,
            shortDescription: parsed.data.shortDescription,
            serviceType: parsed.data.serviceType as any,
            status: parsed.data.status as any,
            categoryId: parsed.data.categoryId,
            canonicalServiceId: parsed.data.canonicalServiceId,
            priceCents: parsed.data.priceCents,
            currency: parsed.data.currency,
            pricingType: parsed.data.pricingType,
            countryId: parsed.data.countryId,
            stateId: parsed.data.stateId,
            cityId: parsed.data.cityId,
            neighborhood: parsed.data.neighborhood,
            metadata: parsed.data.metadata,
          },
          ActorIntent.OFFER_SERVICE // Intent canônico para criar serviço
        );

        return reply.status(201).send({ ok: true, data: service });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar serviço');
        return reply.status(400).send({
          error: 'Erro ao criar serviço',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /services/:id
   * Buscar serviço por ID
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
      const service = await servicesService.getService(req.tenant.id, req.params.id);

      if (!service) {
        return reply.status(404).send({ error: 'Serviço não encontrado' });
      }

      return reply.send({ ok: true, data: service });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar serviço');
      return reply.status(500).send({
        error: 'Erro ao buscar serviço',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /actors/:id/services
   * Listar serviços de um Actor
   * 🔴 BLINDAGEM: Nenhuma query deve usar serviço como filtro decisório
   */
  fastify.get<{ Params: { id: string }; Querystring: { status?: string } }>(
    '/actors/:id/services',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      try {
        const filters = req.query.status
          ? { status: req.query.status as any }
          : undefined;

        const services = await servicesService.getActorServices(
          req.tenant.id,
          req.params.id,
          filters
        );

        return reply.send({ ok: true, data: services });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar serviços do actor');
        return reply.status(500).send({
          error: 'Erro ao listar serviços do actor',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /services/:id
   * Atualizar serviço
   */
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateServiceSchema> }>(
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
      const parsed = updateServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      // 🔴 DECISION-0113 / DECISION-0131 §B7 / Z2-R6.1 — autoridade sobre o serviço vem da representação
      // do actor DONO (server-resolved a partir do serviço atual), não de actorId declarado pelo cliente.
      // req.user.userId DEVE representar currentService.actorId via canRepresentActor (fail-closed → 403)
      // ANTES do update.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Autenticação obrigatória (req.user.userId)' });
      }
      const current = await servicesService.getService(req.tenant.id, req.params.id);
      if (!current) {
        return reply.status(404).send({ ok: false, error: 'Serviço não encontrado' });
      }
      const canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, current.actorId);
      if (!canRep) {
        return reply.status(403).send({ ok: false, code: 'SERVICE_ACTOR_NOT_REPRESENTABLE', error: 'Sem autoridade sobre o actor dono do serviço (canRepresentActor)' });
      }

      try {
        const service = await servicesService.updateService(
          req.tenant.id,
          req.params.id,
          userId,
          {
            name: parsed.data.name,
            description: parsed.data.description,
            shortDescription: parsed.data.shortDescription,
            serviceType: parsed.data.serviceType as any,
            status: parsed.data.status as any,
            categoryId: parsed.data.categoryId,
            priceCents: parsed.data.priceCents,
            currency: parsed.data.currency,
            pricingType: parsed.data.pricingType,
            countryId: parsed.data.countryId,
            stateId: parsed.data.stateId,
            cityId: parsed.data.cityId,
            neighborhood: parsed.data.neighborhood,
            metadata: parsed.data.metadata,
          }
        );

        return reply.send({ ok: true, data: service });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao atualizar serviço');
        return reply.status(400).send({
          error: 'Erro ao atualizar serviço',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ============================================================
  // AGENDA / AVAILABILITY DO SERVIÇO (DECISION-0109 — Bank-free)
  // Adapter FINO sobre o CORE real `availability` (owner_type='service'). Reconcilia os endpoints
  // que o frontend já chama (/services/:serviceId/availability) com a verdade temporal do core —
  // SEM SSOT paralelo, SEM booking, SEM Bank. POST/PUT exigem dono; GET é leitura pública.
  // ============================================================

  const availabilityCreateSchema = z.object({
    availabilityType: z.enum(['fixed', 'recurring', 'on_demand']).optional(),
    status: z.enum(['active', 'paused']).optional(),
    startDatetime: z.string().min(1),
    endDatetime: z.string().min(1),
    timezone: z.string().optional(),
    capacity: z.number().int().min(0).nullable().optional(),
    metadata: z.record(z.any()).optional(),
  });
  const availabilityUpdateSchema = z.object({
    availabilityType: z.enum(['fixed', 'recurring', 'on_demand']).optional(),
    status: z.enum(['active', 'paused']).optional(),
    startDatetime: z.string().min(1).optional(),
    endDatetime: z.string().min(1).optional(),
    timezone: z.string().optional(),
    capacity: z.number().int().min(0).nullable().optional(),
    metadata: z.record(z.any()).optional(),
  });
  // Projeção honesta para o frontend (ServiceAvailability): id = availabilityId; serviceId = ownerId.
  const toServiceAvailability = (a: any) => ({
    id: a.availabilityId,
    tenantId: a.tenantId,
    serviceId: a.ownerId,
    availabilityType: a.availabilityType,
    status: a.status,
    startDatetime: a.startDatetime instanceof Date ? a.startDatetime.toISOString() : a.startDatetime,
    endDatetime: a.endDatetime instanceof Date ? a.endDatetime.toISOString() : a.endDatetime,
    timezone: a.timezone,
    capacity: a.capacity ?? null,
    metadata: a.metadata ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });

  /** POST /services/:serviceId/availability — cria agenda do serviço (delega ao core). Dono. */
  fastify.post<{ Params: { serviceId: string }; Body: z.infer<typeof availabilityCreateSchema> }>(
    '/:serviceId/availability',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }
      const parsed = availabilityCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
      }
      // 🔴 AUDIT-004 — autoridade da agenda vem da REPRESENTAÇÃO do actor DONO (server-resolved a
      // partir do serviço atual), não de actionContext.actorId declarado pelo cliente. req.user.userId
      // DEVE representar current.actorId via canRepresentActor (fail-closed → 403) ANTES de escrever.
      // Espelha POST / (L84) e PUT /:id (L230); alinhado ao core availability (unified-*.routes L254).
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Autenticação obrigatória (req.user.userId)' });
      }
      const current = await servicesService.getService(req.tenant.id, req.params.serviceId);
      if (!current) {
        return reply.status(404).send({ ok: false, error: 'Serviço não encontrado' });
      }
      const canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, current.actorId);
      if (!canRep) {
        return reply.status(403).send({ ok: false, code: 'SERVICE_ACTOR_NOT_REPRESENTABLE', error: 'Sem autoridade sobre o actor dono do serviço (canRepresentActor)' });
      }
      try {
        const availability = await servicesService.createServiceAvailability(
          req.tenant.id,
          current.actorId,
          req.params.serviceId,
          {
            availabilityType: parsed.data.availabilityType as any,
            status: parsed.data.status as any,
            startDatetime: new Date(parsed.data.startDatetime),
            endDatetime: new Date(parsed.data.endDatetime),
            timezone: parsed.data.timezone,
            capacity: parsed.data.capacity,
            metadata: parsed.data.metadata,
          }
        );
        return reply.status(201).send({ ok: true, data: toServiceAvailability(availability) });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar disponibilidade de serviço');
        return reply.status(400).send({
          error: 'Erro ao criar disponibilidade',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /** GET /services/:serviceId/availability — leitura pública LEGADA (owner_type='service'), CONTIDA. */
  fastify.get<{ Params: { serviceId: string }; Querystring: { status?: string } }>(
    '/:serviceId/availability',
    async (req, reply) => {
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }
      try {
        // 🔴 F-SERVICE-AVAILABILITY-LEGACY-PUBLIC-ENDPOINT-CONTAINMENT-SLICE-A2B (DECISION-0156 /
        //    DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT R2): endpoint público legado. Para serviço
        //    canônico-bound, o SSOT temporal reservável é a OFERTA (owner_type='service_offering'), NUNCA o
        //    escopo legado owner_type='service' — então NÃO expomos as janelas 'service' como agenda reservável
        //    verdadeira. Terminal honesto + vazio controlado. O dado legado NÃO é apagado, o enum e os writers
        //    seguem intactos, e a agenda reservável real vive na oferta. Consumidores do endpoint são órfãos ou
        //    tratam vazio (getServiceForDiscovery usa `.catch(() => [])`), então nada vivo quebra.
        const service = await servicesService.getService(req.tenant.id, req.params.serviceId);
        if (service?.canonicalServiceId) {
          return reply.send({
            ok: true,
            data: [],
            contained: true,
            reason: 'SERVICE_LEVEL_AVAILABILITY_LEGACY_CONTAINED',
            message:
              'Disponibilidade reservável vive na oferta (service_offering). O endpoint service-level (owner_type=service) é legado/contido (DECISION-0156).',
          });
        }
        // Serviço sem canonical (legado puro, inexistente sob F-OFFER-2A) preserva o comportamento anterior.
        const list = await servicesService.listServiceAvailabilities(req.tenant.id, req.params.serviceId, {
          status: req.query.status as any,
        });
        return reply.send({ ok: true, data: list.map(toServiceAvailability) });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar disponibilidades de serviço');
        return reply.status(400).send({
          error: 'Erro ao listar disponibilidades',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /** PUT /services/:serviceId/availability/:availabilityId — atualiza janela (delega ao core). Dono. */
  fastify.put<{ Params: { serviceId: string; availabilityId: string }; Body: z.infer<typeof availabilityUpdateSchema> }>(
    '/:serviceId/availability/:availabilityId',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }
      const parsed = availabilityUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
      }
      // 🔴 AUDIT-004 — autoridade da agenda vem da REPRESENTAÇÃO do actor DONO (server-resolved a
      // partir do serviço atual), não de actionContext.actorId declarado pelo cliente. req.user.userId
      // DEVE representar current.actorId via canRepresentActor (fail-closed → 403) ANTES de escrever.
      // Espelha POST / (L84) e PUT /:id (L230); alinhado ao core availability (unified-*.routes L254).
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Autenticação obrigatória (req.user.userId)' });
      }
      const current = await servicesService.getService(req.tenant.id, req.params.serviceId);
      if (!current) {
        return reply.status(404).send({ ok: false, error: 'Serviço não encontrado' });
      }
      const canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, current.actorId);
      if (!canRep) {
        return reply.status(403).send({ ok: false, code: 'SERVICE_ACTOR_NOT_REPRESENTABLE', error: 'Sem autoridade sobre o actor dono do serviço (canRepresentActor)' });
      }
      try {
        const availability = await servicesService.updateServiceAvailability(
          req.tenant.id,
          current.actorId,
          req.params.serviceId,
          req.params.availabilityId,
          {
            availabilityType: parsed.data.availabilityType as any,
            status: parsed.data.status as any,
            startDatetime: parsed.data.startDatetime ? new Date(parsed.data.startDatetime) : undefined,
            endDatetime: parsed.data.endDatetime ? new Date(parsed.data.endDatetime) : undefined,
            timezone: parsed.data.timezone,
            capacity: parsed.data.capacity,
            metadata: parsed.data.metadata,
          }
        );
        return reply.send({ ok: true, data: toServiceAvailability(availability) });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao atualizar disponibilidade de serviço');
        return reply.status(400).send({
          error: 'Erro ao atualizar disponibilidade',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /services/discover
   * Descobrir serviços com filtros explícitos
   * 🔴 BLINDAGEM: NÃO cria ranking, score ou recomendação
   * 🔴 BLINDAGEM: Apenas consulta determinística e explícita
   */
  fastify.get<{
    Querystring: {
      category_id?: string;
      city_id?: string;
      state_id?: string;
      country_id?: string;
      starts_at?: string; // ISO 8601 date string
      ends_at?: string; // ISO 8601 date string
      has_availability?: string; // 'true' | 'false'
      actor_type?: 'user' | 'page' | 'group' | 'channel';
      // 🔵 SLICE-2A (discovery by genre over HTTP): exposição THIN dos filtros JÁ SELADOS da camada de
      // serviço (C1b gênero, C1c-a equipamento, F-PERFORMER-AUDIENCE-RANGE contains-N). Parse fino +
      // pass-through — NENHUMA lógica nova de matching aqui (a verdade vive em discoverServices).
      subject_concept_id?: string; // uuid — gênero (subject-concept governado)
      equipment_concept_id?: string; // uuid — equipamento (concept governado)
      audience_size?: string; // inteiro positivo — N pessoas (faixa da oferta CONTÉM N)
      limit?: string;
      offset?: string;
    };
  }>('/discover', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const query = req.query;

      // Converter has_availability de string para boolean
      const hasAvailability =
        query.has_availability === 'true'
          ? true
          : query.has_availability === 'false'
          ? false
          : undefined;

      // 🔵 SLICE-2A — parse FINO dos novos filtros (fail-closed 400 em vez de deixar uuid/número inválido
      // virar erro de cast no Postgres). Sem valor = comportamento atual (filtro ausente).
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (query.subject_concept_id !== undefined && !UUID_RE.test(query.subject_concept_id)) {
        return reply.status(400).send({ error: 'subject_concept_id inválido (uuid esperado)' });
      }
      if (query.equipment_concept_id !== undefined && !UUID_RE.test(query.equipment_concept_id)) {
        return reply.status(400).send({ error: 'equipment_concept_id inválido (uuid esperado)' });
      }
      let audienceSize: number | undefined;
      if (query.audience_size !== undefined) {
        const n = Number(query.audience_size);
        if (!Number.isInteger(n) || n <= 0) {
          return reply.status(400).send({ error: 'audience_size inválido (inteiro positivo esperado)' });
        }
        audienceSize = n;
      }

      const filters = {
        categoryId: query.category_id,
        subjectConceptId: query.subject_concept_id,
        equipmentConceptId: query.equipment_concept_id,
        audienceSize,
        cityId: query.city_id,
        stateId: query.state_id,
        countryId: query.country_id,
        startDate: query.starts_at,
        endDate: query.ends_at,
        hasAvailability,
        actorType: query.actor_type,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      };

      const services = await servicesService.discoverServices(req.tenant.id, filters);

      return reply.send({
        ok: true,
        data: services,
        count: services.length,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao descobrir serviços');
      return reply.status(500).send({
        error: 'Erro ao descobrir serviços',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default servicesRoutes;


