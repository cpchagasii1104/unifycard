// src/modules/social/social-2.0.routes.ts
// Rotas do Social 2.0 - Feed, Posts, Reactions, Comments, Actors, Ledger

import { FastifyPluginAsync } from 'fastify';
import { social2Service } from './social-2.0.service';
import { actorRepository } from './actor.repository';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { socialLedgerService } from './social-ledger.service';
import { socialVotesService } from './social-votes.service';
import { resolveActiveActorFromRequest } from './actor.utils';
import { recordActorSwitch } from './actor-audit.service';
import { runQueryWithTenant } from '@core/database/pool';
import { getLocalUserIdByGlobalUserId } from '@modules/identity/actor-ssot.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { RELATIONSHIP_LABELS } from '@modules/relationships/actor-relationship.types';
import { z } from 'zod';

const createPostSchema = z.object({
  content: z.string().min(1),
  actor_id: z.string().uuid().optional(),
  media_ids: z.array(z.string().uuid()).optional(),
  intent: z.enum(['personal', 'friends', 'booking', 'service_offer', 'product_offer', 'project', 'vote', 'event']).optional(),
  intent_metadata: z.record(z.any()).optional(),
  targeting: z.object({
    demographics: z.object({
      age_range: z.array(z.number()).length(2).optional() as unknown as z.ZodType<[number, number] | undefined>,
      gender: z.array(z.enum(['male', 'female', 'other'])).optional(),
    }).optional(),
    lifestyle: z.object({
      drinks: z.boolean().optional(),
      smokes: z.boolean().optional(),
    }).optional(),
    mobility: z.object({
      has_car: z.boolean().optional(),
      uses_bike: z.boolean().optional(),
      uses_skate: z.boolean().optional(),
    }).optional(),
    interests: z.array(z.string().uuid()).optional(),
    professions: z.array(z.string().uuid()).optional(),
    locations: z.object({
      radius_km: z.number().optional(),
      city_id: z.string().uuid().optional(),
    }).optional(),
  }).optional(),
  cta: z.object({
    type: z.enum(['booking', 'service', 'payment']),
    target_actor_id: z.string().uuid().optional(),
    target_group_id: z.string().uuid().optional(),
    price: z.number().positive().optional(),
    currency: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }).optional(),
  group_id: z.string().uuid().optional(), // ID do grupo para vincular o post
  // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5): vocabulário GOVERNADO (Lei §8) — espelha
  // o CHECK físico chk_posts_visibility. Ausente = 'public' (comportamento de hoje, não regride).
  visibility: z.enum(['public', 'connections', 'only_me']).optional(),
  // DECISION-0162: refinamento OPCIONAL da plateia por tipo de relação — COMPÕE do vocabulário
  // GOVERNADO do typed-edge (RELATIONSHIP_LABELS), nunca enumera paralelo.
  audience_relationship_types: z.array(z.enum(RELATIONSHIP_LABELS)).optional(),
});

const reactionSchema = z.object({
  reaction_type: z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']).default('like'),
});

const commentSchema = z.object({
  content: z.string().min(1),
  parent_comment_id: z.string().uuid().optional(),
});

const social2Routes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /social/feed?cursor=&actor_type=&actor_id=&group_id=&scope=&value=&include_global=
   *
   * Feed com cursor pagination e modo de atuação (PF vs PJ).
   * Quando group_id é fornecido, retorna apenas posts do grupo.
   *
   * DECISION-0030 (F3): filtro de proximidade opcional via {scope, value}:
   *   - scope=radius_km, value=N → posts dentro de N km da localização ativa do actor
   *   - scope=city → posts cujo address.city_id = user.address.city_id
   *   - scope=state → posts cujo address.state_id = user.address.state_id
   *   - scope=unlimited → sem filtro geo (default quando scope ausente)
   *   - include_global=true → também inclui posts com address_id IS NULL
   *
   * Backward compat: ausência de scope = comportamento atual (sem filtro geo).
   */
  fastify.get<{
    Querystring: {
      cursor?: string;
      limit?: string;
      actor_type?: 'user' | 'page';
      actor_id?: string;
      actor_status?: string; // Status da empresa (PROVISIONAL, VERIFIED, etc)
      user_preferences?: string; // JSON string: { music_genres?: string[], event_types?: string[] }
      user_location?: string; // JSON string: { lat: number, lng: number }
      group_id?: string; // ID do grupo para filtrar posts (opcional)
      // DECISION-0030 (F3): payload polimórfico de filtro geo
      scope?: 'radius_km' | 'city' | 'state' | 'unlimited';
      value?: string; // número em km quando scope=radius_km (parsed para number)
      include_global?: string; // 'true' / 'false' (parsed para boolean)
    };
  }>('/feed', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const cursor = req.query.cursor;
      const limit = parseInt(req.query.limit || '20', 10);
      const safeLimit = Math.min(Math.max(1, limit), 50);
      
      // REGRA: actor_type é OBRIGATÓRIO (não pode ser genérico)
      const actorType = req.query.actor_type;
      if (!actorType || (actorType !== 'user' && actorType !== 'page')) {
        return reply.status(400).send({ 
          error: 'actor_type é obrigatório e deve ser "user" (Pessoa Física) ou "page" (Pessoa Jurídica)' 
        });
      }
      
      // 🔴 F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5, DECISION-0113): `actor_id` do
      // querystring é HINT client-declared, nunca autoridade — a partir de agora ele passa a ser
      // LOAD-BEARING para a plateia 'connections' (decide QUEM está lendo). Sem prova de
      // representação, um atacante poderia passar ?actor_id=<vítima> para ler como se fosse ela
      // e enxergar posts 'connections' que só a vítima veria. Fail-safe (não 403 — degrada para
      // "meu próprio actor", que é o fallback que getFeed já faz sozinho quando actorId=undefined).
      let actorId: string | undefined = undefined;
      const declaredActorId = req.query.actor_id || req.actionContext.actorId;
      if (declaredActorId) {
        try {
          if (await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, declaredActorId)) {
            actorId = declaredActorId;
          }
        } catch {
          actorId = undefined;
        }
      }
      const actorStatus = req.query.actor_status || undefined; // Status da empresa
      
      // EVENTOS ÂNCORA: Preferências e geolocalização (opcionais)
      let userPreferences: { music_genres?: string[]; event_types?: string[] } | undefined = undefined;
      if (req.query.user_preferences) {
        try {
          userPreferences = JSON.parse(req.query.user_preferences);
        } catch (err) {
          fastify.log.warn({ err }, 'Erro ao parsear user_preferences (ignorando)');
        }
      }
      
      let userLocation: { lat: number; lng: number } | undefined = undefined;
      if (req.query.user_location) {
        try {
          const parsed = JSON.parse(req.query.user_location);
          if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
            userLocation = { lat: parsed.lat, lng: parsed.lng };
          }
        } catch (err) {
          fastify.log.warn({ err }, 'Erro ao parsear user_location (ignorando)');
        }
      }

      const groupId = req.query.group_id || undefined;

      // DECISION-0030 (F3): parse proximityFilter
      let proximityFilter:
        | import('@core/location/feed-proximity.types').FeedProximityFilterInput
        | undefined = undefined;
      const rawScope = req.query.scope;
      if (rawScope === 'radius_km' || rawScope === 'city' || rawScope === 'state' || rawScope === 'unlimited') {
        let parsedValue: number | undefined = undefined;
        if (rawScope === 'radius_km') {
          const v = parseFloat(req.query.value ?? '');
          if (!Number.isFinite(v) || v <= 0) {
            return reply.status(400).send({
              error: 'scope=radius_km requer value > 0 (km)',
            });
          }
          parsedValue = v;
        }
        const includeGlobal = req.query.include_global === 'true';
        proximityFilter = {
          scope: rawScope,
          value: parsedValue,
          includeGlobal,
        };
      }

      const feed = await social2Service.getFeed(
        req.tenant.id,
        req.actionContext.actorId,
        cursor,
        safeLimit,
        actorType,
        actorId,
        actorStatus,
        userPreferences,
        userLocation,
        groupId,
        proximityFilter
      );

      return reply.send(feed);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar feed');
      return reply.status(500).send({ error: 'Erro ao buscar feed' });
    }
  });

  /**
   * POST /social/posts
   * Cria um novo post
   */
  fastify.post<{
    Body: {
      content: string;
      actor_id?: string;
      media_ids?: string[];
    };
  }>('/posts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = createPostSchema.parse(req.body);
      
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const createdAsActorId = req.actionContext.actorId;

      // 🔴 DECISION-0113 / DECISION-0131 §B7 / Z2-R6.2 — o autor declarado do post (`validated.actor_id`) é
      // o actor que assina/publica. actorId declarado pelo cliente é HINT, nunca autoridade: o principal
      // autenticado (`req.user.userId`, server-side) DEVE provar representação desse actor via
      // canRepresentActor (fail-closed → 403) ANTES de criar o post. `requirePermission('publish_feed')`
      // (abaixo) é permissão de MÓDULO/capability, não autoridade sobre o actor autor — preservada como
      // gate adicional, NUNCA substituto. Sem actor_id → autoria do próprio actor do usuário (representável
      // por construção via ensureUserActor no service).
      if (validated.actor_id) {
        let canRepresentAuthor = false;
        try {
          const { authorizationService } = await import('@core/authorization/authorization.service');
          canRepresentAuthor = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id);
        } catch {
          canRepresentAuthor = false;
        }
        if (!canRepresentAuthor) {
          return reply.status(403).send({ ok: false, code: 'SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', error: 'Sem autoridade para publicar como o actor declarado (canRepresentActor)' });
        }
      }

      // CONTINUOUS PRODUCTION: Verificar permissão específica para publicar feed
      // Action context já foi resolvido pelo middleware
      if (req.actionContext && validated.actor_id) {
        const { requirePermission } = await import('@core/authorization/require-permission.guard');
        const guard = requirePermission('publish_feed');
        await guard(req, reply);
        
        // Se guard retornou resposta, parar execução
        if (reply.sent) {
          return;
        }
      }
      
      const post = await social2Service.createPost(
        req.tenant.id,
        req.user.id,
        validated.content,
        validated.actor_id,
        validated.media_ids || [],
        validated.intent,
        validated.intent_metadata,
        validated.targeting,
        validated.cta,
        validated.group_id, // Passar groupId para o service
        req.user.id, // CONTINUOUS PRODUCTION: Audit field (createdByUserId)
        createdAsActorId, // CONTINUOUS PRODUCTION: Audit field
        validated.visibility, // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5)
        validated.audience_relationship_types // DECISION-0162: refinamento por tipo de relação
      );

      return reply.status(201).send(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
      }
      fastify.log.error({ err: error }, 'Erro ao criar post');
      return reply.status(500).send({ error: 'Erro ao criar post' });
    }
  });

  /**
   * POST /social/posts/:id/reactions
   * Adiciona ou atualiza reação
   */
  fastify.post<{
    Params: { id: string };
    Querystring: {
      actor_id?: string;
      actor_type?: 'user' | 'page';
    };
    Body: {
      reaction_type?: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
    };
  }>('/posts/:id/reactions', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = reactionSchema.parse(req.body);

      // 🔴 IMPERSONATION FIX (triagem de autoridade 2026-07-04): o actionContext.actorId é
      // client-declared; o service assume actorId "JÁ RESOLVIDO server-side". Sem prova, qualquer
      // autenticado reagiria COMO outro actor. Provar representação (DECISION-0113), fail-closed —
      // idêntico ao gate de createPost neste arquivo.
      const { authorizationService: authzReact } = await import('@core/authorization/authorization.service');
      if (!(await authzReact.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId))) {
        return reply.status(403).send({ error: 'Sem autoridade para reagir como o actor declarado' });
      }
      const reaction = await social2Service.toggleReaction(
        req.tenant.id,
        req.params.id,
        req.actionContext.actorId,
        validated.reaction_type
      );

      return reply.send(reaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
      }
      fastify.log.error({ err: error }, 'Erro ao adicionar reação');
      return reply.status(500).send({ error: 'Erro ao adicionar reação' });
    }
  });

  /**
   * GET /social/posts/:id/comments?cursor&limit
   * Busca comentários de um post
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      cursor?: string;
      limit?: string;
    };
  }>('/posts/:id/comments', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const cursor = req.query.cursor;
      const limit = parseInt(req.query.limit || '20', 10);
      const safeLimit = Math.min(Math.max(1, limit), 50);

      const result = await social2Service.getComments(
        req.tenant.id,
        req.params.id,
        cursor,
        safeLimit
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar comentários');
      return reply.status(500).send({ error: 'Erro ao buscar comentários' });
    }
  });

  /**
   * POST /social/posts/:id/comments
   * Adiciona comentário
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      content: string;
      parent_comment_id?: string;
    };
  }>('/posts/:id/comments', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = commentSchema.parse(req.body);
      // 🔴 IMPERSONATION FIX (triagem 2026-07-04): provar representação do actor declarado antes de
      // comentar COMO ele (o service assume actorId já resolvido server-side). Fail-closed.
      const { authorizationService: authzComment } = await import('@core/authorization/authorization.service');
      if (!(await authzComment.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId))) {
        return reply.status(403).send({ error: 'Sem autoridade para comentar como o actor declarado' });
      }
      const comment = await social2Service.createComment(
        req.tenant.id,
        req.params.id,
        req.actionContext.actorId,
        validated.content,
        validated.parent_comment_id
      );

      return reply.status(201).send(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
      }
      fastify.log.error({ err: error }, 'Erro ao criar comentário');
      return reply.status(500).send({ error: 'Erro ao criar comentário' });
    }
  });

  /**
   * GET /social/actors/available
   * Lista actors disponíveis para o usuário (pessoal + empresas com permissão)
   */
  fastify.get('/actors/available', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // 🔴 F-SOCIAL-ACTORS-AVAILABLE-DEAD-HINT-BRANCH-HYGIENE
      // (DT-SOCIAL-ACTORS-AVAILABLE-DEAD-HINT-BRANCH): o subject da listagem é SEMPRE o principal
      // autenticado server-side (req.user.id). req.actionContext.actorId é HINT do cliente, NUNCA
      // autoridade — derivar listingUserId dele listaria os actors/empresas representáveis de OUTRO
      // user (cross-user leak). Esta rota lista "actors disponíveis PARA O USUÁRIO" (o próprio). O branch
      // morto que flipava o subject pelo hint (contido por skip do action-context middleware, mas
      // armadilha latente) foi REMOVIDO — ancoragem incondicional no principal, fail-closed por construção.
      const listingUserId = req.user!.id as string;

      const actors = await actorRepository.findAvailableActors(req.tenant.id, listingUserId);

      // 🔴 AUDITORIA: Registrar troca de actor se houver mudança
      // (Frontend pode chamar endpoint específico para registrar troca explícita)
      // Por enquanto, apenas retornar actors disponíveis

      return reply.send({ actors });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar actors disponíveis');
      return reply.status(500).send({ error: 'Erro ao buscar actors disponíveis' });
    }
  });

  /**
   * POST /social/actors/switch
   * Registra troca de Actor ativo (auditoria)
   * 🔴 BLINDAGEM: Evento interno para auditoria, debugging e segurança
   * NÃO é feed, NÃO é visível ao usuário final
   */
  fastify.post<{
    Body: {
      from_actor_id?: string | null;
      to_actor_id: string;
    };
  }>('/actors/switch', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const actorId = req.actionContext.actorId;

      const { from_actor_id, to_actor_id } = req.body;

      // Validar que to_actor_id existe e pertence ao usuário
      const toActor = await actorRepository.findById(req.tenant.id, to_actor_id);
      if (!toActor) {
        return reply.status(404).send({ error: 'Actor de destino não encontrado' });
      }

      // Verificar se usuário tem acesso ao actor
      const userId = req.user!.id;
      const availableActors = await actorRepository.findAvailableActors(req.tenant.id, userId);
      const hasAccess = availableActors.some(a => a.actor_id === to_actor_id);
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Acesso negado ao actor' });
      }

      // Registrar evento de auditoria
      await recordActorSwitch(
        req.tenant.id,
        userId,
        from_actor_id || null,
        to_actor_id,
        {
          route: req.url,
          method: req.method,
        }
      );

      return reply.send({ ok: true, message: 'Troca de actor registrada' });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao registrar troca de actor');
      return reply.status(500).send({ error: 'Erro ao registrar troca de actor' });
    }
  });

  /**
   * GET /social/actors/:id
   * Busca perfil/página do actor
   */
  fastify.get<{
    Params: { id: string };
  }>('/actors/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const actor = await actorRepository.findById(req.tenant.id, req.params.id);
      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }

      // 🔴 F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5): resolve QUEM está lendo,
      // 100% server-side (req.user.globalUserId → actor próprio via ensureUserActor — nunca
      // client-declared), ANTES de buscar os posts, para a plateia ser obedecida na leitura.
      let viewerActorId: string | null = null;
      const gFollow = req.user?.globalUserId;
      if (gFollow) {
        const localUid = await getLocalUserIdByGlobalUserId(req.tenant.id, gFollow);
        if (localUid) {
          const currentActor = await ensureUserActor(req.tenant.id, localUid);
          viewerActorId = currentActor.actor_id;
        }
      }

      // Busca posts do actor (plateia obedecida — viewerActorId decide 'connections'/'only_me')
      const posts = await social2Service.getActorPosts(req.tenant.id, req.params.id, 20, viewerActorId);

      // Busca contadores (coerentes com a plateia — mesmo viewerActorId de getActorPosts)
      const counts = await social2Service.getActorCounts(req.tenant.id, req.params.id, viewerActorId);

      // Verifica se o usuário atual está seguindo
      const isFollowing = viewerActorId
        ? await social2Service.isFollowing(req.tenant.id, viewerActorId, req.params.id)
        : false;

      return reply.send({
        actor,
        posts,
        counts,
        is_following: isFollowing,
        // Achado de Clayton (2026-07-07): "Seguir" aparecia no PRÓPRIO perfil. A VERDADE é do backend
        // (viewerActorId resolvido server-side): is_own=true → a tela NÃO projeta o botão (o CHECK
        // not-self do banco já rejeitaria; isto é projeção honesta, não autoridade).
        is_own: viewerActorId === req.params.id,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar actor');
      return reply.status(500).send({ error: 'Erro ao buscar actor' });
    }
  });

  /**
   * POST /social/actors/:id/follow
   * Segue um actor
   */
  fastify.post<{
    Params: { id: string };
  }>('/actors/:id/follow', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const g = req.user.globalUserId;
      if (!g) {
        return reply.status(400).send({ error: 'global_user_id ausente' });
      }
      const localUid = await getLocalUserIdByGlobalUserId(req.tenant.id, g);
      if (!localUid) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await ensureUserActor(req.tenant.id, localUid);

      const result = await social2Service.followActor(
        req.tenant.id,
        currentActor.actor_id,
        req.params.id
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao seguir actor');
      return reply.status(500).send({ error: 'Erro ao seguir actor' });
    }
  });

  /**
   * POST /social/actors/:id/unfollow
   * Deixa de seguir um actor
   */
  fastify.post<{
    Params: { id: string };
  }>('/actors/:id/unfollow', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const gUn = req.user.globalUserId;
      if (!gUn) {
        return reply.status(400).send({ error: 'global_user_id ausente' });
      }
      const localUidUn = await getLocalUserIdByGlobalUserId(req.tenant.id, gUn);
      if (!localUidUn) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await ensureUserActor(req.tenant.id, localUidUn);

      const result = await social2Service.unfollowActor(
        req.tenant.id,
        currentActor.actor_id,
        req.params.id
      );

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao deixar de seguir actor');
      return reply.status(500).send({ error: 'Erro ao deixar de seguir actor' });
    }
  });

  /**
   * GET /social/ledger
   * Busca ledger do usuário (ganhos pessoais + repasses)
   */
  fastify.get<{
    Querystring: { limit?: string };
  }>('/ledger', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔴 DECISION-0113 fatia 6 (leitura cross-user): o actorId vem do actionContext (spoofável). Prova que o
    // req.user pode REPRESENTAR o actor ANTES de ler ledger financeiro alheio (fail-closed → 403 não-leak).
    let canReadLedger = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadLedger = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadLedger = false; }
    if (!canReadLedger) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const entries = await socialLedgerService.getUserLedger(
        req.tenant.id,
        req.actionContext.actorId,
        limit
      );
      return reply.send({ entries });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar ledger');
      return reply.status(500).send({ error: 'Erro ao buscar ledger' });
    }
  });

  /**
   * GET /social/ledger/summary
   * Resumo do ledger do usuário
   */
  fastify.get('/ledger/summary', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔴 DECISION-0113 fatia 6 (leitura cross-user): representabilidade ANTES do resumo financeiro alheio.
    let canReadSummary = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadSummary = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadSummary = false; }
    if (!canReadSummary) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      const summary = await socialLedgerService.getUserLedgerSummary(
        req.tenant.id,
        req.actionContext.actorId
      );
      return reply.send(summary);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar resumo do ledger');
      return reply.status(500).send({ error: 'Erro ao buscar resumo do ledger' });
    }
  });

  /**
   * POST /social/cta/:cta_id/confirm
   * Confirma CTA e gera transação real (ledger)
   */
  fastify.post<{
    Params: { cta_id: string };
    Body: {
      notes?: string;
    };
  }>('/cta/:cta_id/confirm', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { socialLedgerService } = await import('./social-ledger.service');
      const { actorRepository } = await import('./actor.repository');

      // Buscar CTA
      const ctaRow = await runQueryWithTenant<{
        cta_id: string;
        post_id: string;
        cta_type: string;
        target_actor_id: string | null;
        target_group_id: string | null;
        price: number | null;
        currency: string;
      }>(
        req.tenant.id,
        `
        SELECT cta_id, post_id, cta_type, target_actor_id, target_group_id, price, currency
        FROM post_cta
        WHERE cta_id = $1 AND tenant_id = $2 AND is_active = true
        LIMIT 1
        `,
        [req.params.cta_id, req.tenant.id]
      );

      if (!ctaRow) {
        return reply.status(404).send({ error: 'CTA não encontrado ou inativo' });
      }

      const cta = ctaRow;

      const gCta = req.user?.globalUserId;
      if (!gCta) {
        return reply.status(400).send({ error: 'global_user_id ausente' });
      }
      const localUidCta = await getLocalUserIdByGlobalUserId(req.tenant.id, gCta);
      if (!localUidCta) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await ensureUserActor(req.tenant.id, localUidCta);

      // Buscar actor destinatário (se houver)
      let recipientActorId = null;
      if (cta.target_actor_id) {
        recipientActorId = cta.target_actor_id;
      }

      // Calcular valor em centavos
      const amountCents = cta.price ? Math.round(parseFloat(cta.price.toString()) * 100) : 0;

      if (amountCents <= 0) {
        return reply.status(400).send({ error: 'Valor inválido' });
      }

      // Gerar idempotency_key único
      const idempotencyKey = `cta_${cta.cta_id}_${req.actionContext.actorId}_${Date.now()}`;

      // Criar entrada de receita para o destinatário
      const revenueEntry = await socialLedgerService.recordEntry(
        req.tenant.id,
        {
          post_id: cta.post_id,
          cta_id: cta.cta_id,
          recipient_actor_id: recipientActorId || undefined,
          owner_actor_id: currentActor.actor_id,
          amount_cents: amountCents,
          currency: cta.currency || 'BRL',
          amount_type: 'revenue',
          description: `Receita de ${cta.cta_type === 'booking' ? 'agendamento' : cta.cta_type === 'service' ? 'serviço' : 'pagamento'}`,
          metadata: {
            notes: req.body.notes,
            confirmedAt: new Date().toISOString(),
          },
          idempotency_key: `${idempotencyKey}_revenue`,
        }
      );

      // Se houver grupo configurado, calcular e criar repasse (profit_share)
      let profitShareEntry = null;
      if (cta.target_group_id) {
        // Buscar percentual do grupo
        const group = await runQueryWithTenant<{ profit_percentage: number | null }>(
          req.tenant.id,
          `
          SELECT profit_percentage FROM groups
          WHERE group_id = $1 AND tenant_id = $2
          LIMIT 1
          `,
          [cta.target_group_id, req.tenant.id]
        );

        if (group && group.profit_percentage && group.profit_percentage > 0) {
          const profitShareCents = Math.round((amountCents * group.profit_percentage) / 100);
          
          if (profitShareCents > 0) {
            profitShareEntry = await socialLedgerService.recordEntry(
              req.tenant.id,
              {
                post_id: cta.post_id,
                cta_id: cta.cta_id,
                recipient_group_id: cta.target_group_id,
                owner_actor_id: currentActor.actor_id,
                amount_cents: profitShareCents,
                currency: cta.currency || 'BRL',
                amount_type: 'profit_share',
                description: `Repasse de ${group.profit_percentage}% para grupo`,
                metadata: {
                  original_amount_cents: amountCents,
                  percentage: group.profit_percentage,
                },
                idempotency_key: `${idempotencyKey}_profit_share`,
              }
            );
          }
        }
      }

      // FASE 10: Registrar impacto quando CTA é confirmado (SUPPORT)
      try {
        const { impactService } = await import('./impact.service');
        
        // Determinar se é projeto (se tem target_group_id, pode ser projeto)
        const sourceType = cta.target_group_id ? 'project' : 'post';
        const sourceId = cta.target_group_id || cta.post_id;
        
        await impactService.recordImpact({
          tenantId: req.tenant.id,
          actor: {
            actor_id: currentActor.actor_id,
            actor_type: currentActor.actor_type as 'user' | 'page',
          },
          eventType: 'SUPPORT',
          delta: 5,
          sourceType: sourceType as 'project' | 'post',
          sourceId: sourceId,
          metadata: {
            cta_id: cta.cta_id,
            cta_type: cta.cta_type,
            target_group_id: cta.target_group_id,
          },
        });
      } catch (err) {
        // Não quebra confirmação se impacto falhar (log apenas)
        fastify.log.warn({ err }, 'Erro ao registrar impacto de support (não crítico)');
      }

      return reply.status(201).send({
        success: true,
        revenue_entry: revenueEntry,
        profit_share_entry: profitShareEntry,
        message: 'Transação confirmada com sucesso',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao confirmar CTA');
      
      // Se erro de idempotência, retornar sucesso (já foi processado)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        return reply.status(200).send({
          success: true,
          message: 'Transação já foi processada anteriormente',
        });
      }

      return reply.status(500).send({ error: 'Erro ao confirmar CTA' });
    }
  });

  /**
   * POST /social/posts/:post_id/vote
   * Registra voto em uma votação (apenas membros do grupo)
   */
  fastify.post<{
    Params: { post_id: string };
    Querystring: {
      actor_id?: string;
      actor_type?: 'user' | 'page';
    };
    Body: {
      option_index: number;
      option_text?: string;
    };
  }>('/posts/:post_id/vote', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const gVote = req.user.globalUserId;
      if (!gVote) {
        return reply.status(400).send({ ok: false, message: 'global_user_id ausente' });
      }
      const localUidVote = await getLocalUserIdByGlobalUserId(req.tenant.id, gVote);
      if (!localUidVote) {
        return reply.status(404).send({ ok: false, message: 'Usuário não encontrado' });
      }

      // 🔴 CORREÇÃO CRÍTICA: Resolver actor ativo usando função canônica
      // Prioridade: header x-actor-id > query actor_id > erro (sem fallback silencioso)
      const currentActor = await resolveActiveActorFromRequest(
        req,
        req.tenant.id,
        {
          allowUserFallback: false, // Não permitir fallback silencioso para PF
        }
      );

      // Buscar status da empresa se for PJ
      let companyStatus: string | undefined = undefined;
      if (currentActor.actor_type === 'page' && currentActor.company_id) {
        const company = await runQueryWithTenant<{ company_status: string }>(
          req.tenant.id,
          `
          SELECT company_status FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          LIMIT 1
          `,
          [currentActor.company_id, req.tenant.id]
        );
        companyStatus = company?.company_status;
      }

      const result = await socialVotesService.castVote(
        req.tenant.id,
        req.params.post_id,
        currentActor.actor_id,
        req.body.option_index,
        localUidVote
      );

      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao registrar voto');
      return reply.status(400).send({
        ok: false,
        message: error instanceof Error ? error.message : 'Erro ao registrar voto',
      });
    }
  });

  /**
   * GET /social/posts/:post_id/vote/results
   * Busca resultados de uma votação
   */
  fastify.get<{ Params: { post_id: string } }>('/posts/:post_id/vote/results', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const results = await socialVotesService.getVoteResults(
        req.tenant.id,
        req.params.post_id
      );

      if (!results) {
        return reply.status(404).send({ ok: false, message: 'Votação não encontrada' });
      }

      return reply.send({ ok: true, data: results });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar resultados da votação');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar resultados da votação',
      });
    }
  });

  // NOTA: Rotas duplicadas removidas para evitar FST_ERR_DUPLICATED_ROUTE
  // As rotas canônicas são:
  // - POST /social/posts/:post_id/vote (linha 651)
  // - GET /social/posts/:post_id/vote/results (linha 707)

  /**
   * GET /impact/balance
   * Busca saldo de impacto do ator ativo
   * FASE 10: Impacto Real + Ledger por Ator
   */
  fastify.get<{
    Querystring: {
      actor_id: string;
      actor_type: 'user' | 'page';
    };
  }>('/impact/balance', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { impactService } = await import('./impact.service');
      
      const actorId = req.query.actor_id;
      const actorType = req.query.actor_type;
      
      if (!actorId || !actorType) {
        return reply.status(400).send({ 
          error: 'actor_id e actor_type são obrigatórios' 
        });
      }

      const balance = await impactService.getBalance(
        req.tenant.id,
        actorId,
        actorType
      );

      if (!balance) {
        return reply.status(404).send({ error: 'Saldo de impacto não encontrado' });
      }

      return reply.send({
        actor_id: balance.actor_id,
        actor_type: balance.actor_type,
        balance: balance.balance,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar saldo de impacto');
      return reply.status(500).send({ error: 'Erro ao buscar saldo de impacto' });
    }
  });

  /**
   * GET /impact/ledger
   * Busca histórico do ledger de impacto (extrato)
   * FASE 10: Impacto Real + Ledger por Ator
   */
  fastify.get<{
    Querystring: {
      actor_id: string;
      actor_type: 'user' | 'page';
      limit?: string;
    };
  }>('/impact/ledger', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { impactService } = await import('./impact.service');
      
      const actorId = req.query.actor_id;
      const actorType = req.query.actor_type;
      const limit = parseInt(req.query.limit || '20', 10);

      if (!actorId || !actorType) {
        return reply.status(400).send({
          error: 'actor_id e actor_type são obrigatórios'
        });
      }

      // 🔴 DECISION-0113 (canal 3): actor_id da query é HINT, não autoridade. /impact/ledger é EXTRATO
      // detalhado (source_type/source_id/metadata/timestamps) = atividade privada do actor (≠ /impact/balance,
      // que é score agregado público). Prova que o req.user pode REPRESENTAR o actor_id ANTES de ler o extrato
      // alheio (fail-closed → 403 não-leak). /impact/balance permanece B público (intocado).
      let canReadImpactLedger = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canReadImpactLedger = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, actorId);
      } catch { canReadImpactLedger = false; }
      if (!canReadImpactLedger) {
        return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      }

      const history = await impactService.getLedgerHistory(
        req.tenant.id,
        actorId,
        actorType,
        limit
      );

      return reply.send({ entries: history });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar histórico de impacto');
      return reply.status(500).send({ error: 'Erro ao buscar histórico de impacto' });
    }
  });

  /**
   * GET /reputation/permissions
   * Busca permissões do ator baseado em reputação e status
   * FASE 11: Reputação Progressiva & Permissões
   */
  fastify.get<{
    Querystring: {
      actor_id: string;
      actor_type: 'user' | 'page';
      company_status?: string;
    };
  }>('/reputation/permissions', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { reputationService } = await import('./reputation.service');
      
      const actorId = req.query.actor_id;
      const actorType = req.query.actor_type;
      const companyStatus = req.query.company_status;
      
      if (!actorId || !actorType) {
        return reply.status(400).send({ 
          error: 'actor_id e actor_type são obrigatórios' 
        });
      }

      const permissions = await reputationService.getPermissions(
        req.tenant.id,
        actorId,
        actorType,
        companyStatus
      );

      return reply.send(permissions);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar permissões');
      return reply.status(500).send({ error: 'Erro ao buscar permissões' });
    }
  });
};

export default social2Routes;

