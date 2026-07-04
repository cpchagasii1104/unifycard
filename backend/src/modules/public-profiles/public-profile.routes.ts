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
  // ──────────────────────────────────────────────────────────────────────────
  // F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md,
  // selado por Clayton 2026-07-03) — publicar/tirar a PLAQUINHA do actor ativo na vitrine.
  // O actor NUNCA vem do body (actionContext + canRepresentActor, DECISION-0113).
  // Fase 1: 'public' | 'private' ('followers_only' = Fase 2, gated por
  // DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ). Visibilidade NUNCA concede autoridade.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /public-profiles/publish — publica ('public') ou despublica ('private') a plaquinha
   * do PRÓPRIO actor ativo (upsert idempotente; 1 perfil por actor).
   */
  fastify.post<{ Body: { visibility?: string } }>('/public-profiles/publish', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const visibility = req.body?.visibility;
    if (visibility !== 'public' && visibility !== 'private') {
      return reply.status(400).send({ error: "visibility deve ser 'public' ou 'private'" });
    }

    const userId = (req as any).user?.userId ?? (req as any).user?.id;
    try {
      const profile = await publicProfileService.publishForActor(tenantId, actionContext.actorId, visibility, userId);
      return reply.status(201).send({ ok: true, data: profile });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao publicar perfil' });
    }
  });

  /**
   * GET /public-profiles/mine — a plaquinha do próprio actor ativo (null se nunca publicou).
   */
  fastify.get('/public-profiles/mine', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const profile = await publicProfileService.getMineByActor(tenantId, actionContext.actorId);
    return reply.send({ ok: true, data: profile });
  });

  /**
   * GET /public-profiles/global/:actorId
   * Destino do clique no hit global da busca: a página da plaquinha (vitrine) de um actor de
   * QUALQUER comunidade. Cross-tenant por design (só plaquinha pública opt-in, anti-PII/anti-tenant-
   * leak). Exige usuário autenticado (a vitrine é para membros descobrindo membros), mas NÃO exige
   * mesmo tenant. 404 se o actor não publicou perfil público.
   */
  fastify.get<{ Params: { actorId: string } }>('/public-profiles/global/:actorId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    const profile = await publicProfileService.getGlobalPublicProfile(req.params.actorId);
    if (!profile) {
      return reply.status(404).send({ error: 'Perfil público não encontrado' });
    }
    return reply.send({ ok: true, data: profile });
  });

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

    // 🔴 V2 fix: o sujeito é o actor PROVADO (actionContext.actorId), nunca req.body.actorId.
    // O service força isso de novo (defense-in-depth), mas passamos o correto por clareza.
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

    // 🔴 F-DISCOVERY-SLICE-A hardening: representar o actor declarado NÃO basta — o perfil
    // alvo precisa PERTENCER a esse actor (senão user A, representando o próprio actor,
    // editaria perfil de actor alheio por id). Fail-closed.
    const existing = await publicProfileService.getById(tenantId, req.params.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Perfil não encontrado' });
    }
    if (existing.actorId !== actionContext.actorId) {
      return reply.status(403).send({ error: 'Perfil não pertence ao actor representado' });
    }

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
    // 🔴 F-0113: listagem PÚBLICA — visibility FORÇADA a public server-side (cliente NÃO pode pedir
    // private e vazar perfis privados). actorId segue como filtro de recurso público (não autoridade).
    // (minúsculo = CHECK da tabela; o valor maiúsculo antigo nunca casava com linha nenhuma)
    filters.visibility = 'public';
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

    // 'total' (contagem) — o 'totalCents' antigo era vocabulário financeiro indevido num count
    return reply.send({ profiles, total: profiles.length });
  });

  /**
   * POST /public-profiles/:id/visibility
   * Muda visibilidade do perfil
   */
  fastify.post<{
    Params: { id: string };
    Body: { visibility: 'public' | 'private' };
  }>('/public-profiles/:id/visibility', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    if (req.body?.visibility !== 'public' && req.body?.visibility !== 'private') {
      return reply.status(400).send({ error: "visibility deve ser 'public' ou 'private'" });
    }

    // 🔴 F-DISCOVERY-SLICE-A hardening: perfil alvo precisa pertencer ao actor representado
    const target = await publicProfileService.getById(tenantId, req.params.id);
    if (!target) {
      return reply.status(404).send({ error: 'Perfil não encontrado' });
    }
    if (target.actorId !== actionContext.actorId) {
      return reply.status(403).send({ error: 'Perfil não pertence ao actor representado' });
    }

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






