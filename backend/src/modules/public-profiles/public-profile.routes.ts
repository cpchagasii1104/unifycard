// backend/src/modules/public-profiles/public-profile.routes.ts
// SPRINT 79: Rotas REST para Public Profiles

import type { FastifyInstance } from 'fastify';
import { publicProfileService } from './public-profile.service';
import type {
  CreatePublicProfileInput,
  UpdatePublicProfileInput,
  PublicProfileFilters,
} from './public-profile.types';

const publicProfileRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /public-profiles
   * Cria perfil público
   */
  fastify.post<{ Body: CreatePublicProfileInput }>('/public-profiles', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const profile = await publicProfileService.createProfile(
      tenantId,
      req.body,
      actionContext.actingUserId
    );

    return reply.status(201).send(profile);
  });

  /**
   * PATCH /public-profiles/:id
   * Atualiza perfil público
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdatePublicProfileInput;
  }>('/public-profiles/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const profile = await publicProfileService.updateProfile(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actingUserId
    );

    return reply.send(profile);
  });

  /**
   * GET /public-profiles/:slug
   * Busca perfil por slug
   */
  fastify.get<{ Params: { slug: string } }>('/public-profiles/:slug', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const profile = await publicProfileService.getBySlug(tenantId, req.params.slug);

    if (!profile) {
      return reply.status(404).send({ error: 'Perfil não encontrado' });
    }

    return reply.send(profile);
  });

  /**
   * GET /public-profiles
   * Lista perfis públicos
   */
  fastify.get<{
    Querystring: {
      profileType?: string;
      visibility?: string;
      actorId?: string;
      limit?: number;
      offset?: number;
    };
  }>('/public-profiles', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: PublicProfileFilters = {};
    if (req.query.profileType) {
      filters.profileType = req.query.profileType as any;
    }
    if (req.query.visibility) {
      filters.visibility = req.query.visibility as any;
    }
    if (req.query.actorId) {
      filters.actorId = req.query.actorId;
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const profiles = await publicProfileService.listPublicProfiles(tenantId, filters);

    return reply.send({ profiles, total: profiles.length });
  });

  /**
   * POST /public-profiles/:id/visibility
   * Muda visibilidade do perfil
   */
  fastify.post<{
    Params: { id: string };
    Body: { visibility: 'PUBLIC' | 'PRIVATE' };
  }>('/public-profiles/:id/visibility', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const profile = await publicProfileService.changeVisibility(
      tenantId,
      req.params.id,
      req.body.visibility,
      actionContext.actingUserId
    );

    return reply.send(profile);
  });
};

export default publicProfileRoutes;





