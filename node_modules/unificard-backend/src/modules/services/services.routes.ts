// src/modules/services/services.routes.ts
// Rotas do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura, listagem por actor)

import { FastifyPluginAsync } from 'fastify';
import { servicesService } from './services.service';
import { z } from 'zod';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';
import { ActorIntent } from '@modules/social/actor-intents.types';

const createServiceSchema = z.object({
  actorId: z.string().uuid(), // OBRIGATÓRIO
  name: z.string().min(1).max(255),
  slug: z.string().optional(),
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
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
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

      try {
        const service = await servicesService.createService(
          req.tenant.id,
          req.user.userId,
          {
            actorId: parsed.data.actorId, // OBRIGATÓRIO
            name: parsed.data.name,
            slug: parsed.data.slug,
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
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
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
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
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
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
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

      try {
        const service = await servicesService.updateService(
          req.tenant.id,
          req.params.id,
          req.user.userId,
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
      start_date?: string; // ISO 8601 date string
      end_date?: string; // ISO 8601 date string
      has_availability?: string; // 'true' | 'false'
      actor_type?: 'user' | 'page' | 'group' | 'channel';
      limit?: string;
      offset?: string;
    };
  }>('/discover', async (req, reply) => {
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
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

      const filters = {
        categoryId: query.category_id,
        cityId: query.city_id,
        stateId: query.state_id,
        countryId: query.country_id,
        startDate: query.start_date,
        endDate: query.end_date,
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

