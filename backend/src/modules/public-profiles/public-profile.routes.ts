// backend/src/modules/public-profiles/public-profile.routes.ts
// SPRINT 79: Rotas REST para Public Profiles

import type { FastifyInstance } from 'fastify';
import { publicProfileService } from './public-profile.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type {
  CreatePublicProfileInput,
  UpdatePublicProfileInput,
  PublicProfileFilters,
} from './public-profile.types';

/**
 * 🔴 F-0113-CLASSIC-CHANNEL-READERS-BINDING (DECISION-0113): actorId (actionContext/body) é HINT —
 * o utilizador autenticado DEVE representar o actor via canRepresentActor (ownership 'user' / gestão
 * de empresa 'page' / grupo / delegação), fail-closed. Substitui actionContext cliente-declarado como
 * autoridade de ESCRITA de perfil.
 */
async function assertRepresentsActor(req: any, reply: any, actorId: string): Promise<boolean> {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) {
    reply.status(401).send({ error: 'Authentication required' });
    return false;
  }
  let ok = false;
  try {
    ok = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
  } catch {
    ok = false;
  }
  if (!ok) {
    reply.status(403).send({ error: 'Sem autoridade para representar este actor' });
    return false;
  }
  return true;
}

const publicProfileRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /public-profiles
   * Cria perfil público
   */
  fastify.post<{ Body: CreatePublicProfileInput }>('/public-profiles', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const profile = await publicProfileService.createProfile(
      tenantId,
      req.body,
      actionContext.actorId
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

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const profile = await publicProfileService.updateProfile(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId
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
    // 🔴 F-0113: listagem PÚBLICA — visibility FORÇADA a PUBLIC server-side (cliente NÃO pode pedir
    // PRIVATE e vazar perfis privados). actorId segue como filtro de recurso público (não autoridade).
    filters.visibility = 'PUBLIC' as any;
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

    return reply.send({ profiles, totalCents: profiles.length });
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

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const profile = await publicProfileService.changeVisibility(
      tenantId,
      req.params.id,
      req.body.visibility,
      actionContext.actorId
    );

    return reply.send(profile);
  });
};

export default publicProfileRoutes;






