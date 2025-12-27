// src/modules/social/social-2.0.routes.ts
// Rotas do Social 2.0 - Feed, Posts, Reactions, Comments, Actors, Ledger

import { FastifyPluginAsync } from 'fastify';
import { social2Service } from './social-2.0.service';
import { actorRepository } from './actor.repository';
import { socialLedgerService } from './social-ledger.service';
import { socialVotesService } from './social-votes.service';
import { runQueryWithTenant } from '@core/database/pool';
import { z } from 'zod';

const createPostSchema = z.object({
  content: z.string().min(1),
  actor_id: z.string().uuid().optional(),
  media_ids: z.array(z.string().uuid()).optional(),
  intent: z.enum(['personal', 'friends', 'booking', 'service_offer', 'product_offer', 'project', 'vote', 'event']).optional(),
  intent_metadata: z.record(z.any()).optional(),
  targeting: z.object({
    demographics: z.object({
      age_range: z.tuple([z.number(), z.number()]).optional(),
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
   * GET /social/feed?cursor=&actor_type=&actor_id=
   * Feed com cursor pagination e modo de atuação (PF vs PJ)
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
    };
  }>('/feed', async (req, reply) => {
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
      
      const actorId = req.query.actor_id || undefined;
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
          userLocation = JSON.parse(req.query.user_location);
          // Validar coordenadas
          if (typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
            userLocation = undefined;
          }
        } catch (err) {
          fastify.log.warn({ err }, 'Erro ao parsear user_location (ignorando)');
        }
      }

      const feed = await social2Service.getFeed(
        req.tenant.id,
        req.user.globalUserId,
        cursor,
        safeLimit,
        actorType,
        actorId,
        actorStatus,
        userPreferences,
        userLocation
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = createPostSchema.parse(req.body);
      const post = await social2Service.createPost(
        req.tenant.id,
        req.user.id,
        req.user.globalUserId,
        validated.content,
        validated.actor_id,
        validated.media_ids || [],
        validated.intent,
        validated.intent_metadata,
        validated.targeting,
        validated.cta
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = reactionSchema.parse(req.body);
      
      // Buscar actor ativo (pode ser empresa se estiver atuando como empresa)
      const actorId = req.query.actor_id || undefined;
      const actorType = req.query.actor_type as 'user' | 'page' | undefined;
      
      const reaction = await social2Service.toggleReaction(
        req.tenant.id,
        req.params.id,
        req.user.globalUserId,
        validated.reaction_type,
        actorId,
        actorType
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const validated = commentSchema.parse(req.body);
      const comment = await social2Service.createComment(
        req.tenant.id,
        req.params.id,
        req.user.globalUserId,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const actors = await actorRepository.findAvailableActors(
        req.tenant.id,
        req.user.globalUserId
      );

      return reply.send({ actors });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar actors disponíveis');
      return reply.status(500).send({ error: 'Erro ao buscar actors disponíveis' });
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

      // Busca posts do actor
      const posts = await social2Service.getActorPosts(req.tenant.id, req.params.id, 20);

      // Busca contadores
      const counts = await social2Service.getActorCounts(req.tenant.id, req.params.id);

      // Verifica se o usuário atual está seguindo
      let isFollowing = false;
      if (req.user?.globalUserId) {
        const user = await runQueryWithTenant<{ user_id: string }>(
          req.tenant.id,
          `
          SELECT user_id FROM users
          WHERE user_id IN (
            SELECT user_id FROM global_users WHERE global_user_id = $1
          )
          LIMIT 1
          `,
          [req.user.globalUserId]
        );
        if (user) {
          const currentActor = await actorRepository.findOrCreateUserActor(
            req.tenant.id,
            user.user_id,
            req.user.globalUserId
          );
          isFollowing = await social2Service.isFollowing(
            req.tenant.id,
            currentActor.actor_id,
            req.params.id
          );
        }
      }

      return reply.send({
        actor,
        posts,
        counts,
        is_following: isFollowing,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const user = await runQueryWithTenant<{ user_id: string }>(
        req.tenant.id,
        `
        SELECT user_id FROM users
        WHERE user_id IN (
          SELECT user_id FROM global_users WHERE global_user_id = $1
        )
        LIMIT 1
        `,
        [req.user.globalUserId]
      );

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await actorRepository.findOrCreateUserActor(
        req.tenant.id,
        user.user_id,
        req.user.globalUserId
      );

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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const user = await runQueryWithTenant<{ user_id: string }>(
        req.tenant.id,
        `
        SELECT user_id FROM users
        WHERE user_id IN (
          SELECT user_id FROM global_users WHERE global_user_id = $1
        )
        LIMIT 1
        `,
        [req.user.globalUserId]
      );

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await actorRepository.findOrCreateUserActor(
        req.tenant.id,
        user.user_id,
        req.user.globalUserId
      );

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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const entries = await socialLedgerService.getUserLedger(
        req.tenant.id,
        req.user.globalUserId,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const summary = await socialLedgerService.getUserLedgerSummary(
        req.tenant.id,
        req.user.globalUserId
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
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

      // Buscar actor do usuário atual
      const user = await runQueryWithTenant<{ user_id: string }>(
        req.tenant.id,
        `
        SELECT user_id FROM users
        WHERE global_user_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [req.user.globalUserId, req.tenant.id]
      );

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const currentActor = await actorRepository.findOrCreateUserActor(
        req.tenant.id,
        user.user_id,
        req.user.globalUserId
      );

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
      const idempotencyKey = `cta_${cta.cta_id}_${req.user.globalUserId}_${Date.now()}`;

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
            confirmed_at: new Date().toISOString(),
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ ok: false, message: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      // Buscar actor do usuário
      const user = await runQueryWithTenant<{ user_id: string }>(
        req.tenant.id,
        `
        SELECT user_id FROM users
        WHERE global_user_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [req.user.globalUserId, req.tenant.id]
      );

      if (!user) {
        return reply.status(404).send({ ok: false, message: 'Usuário não encontrado' });
      }

      // Buscar actor ativo (pode ser empresa se estiver atuando como empresa)
      // FASE 11: Usar actor_id do query se fornecido (do activeActor do frontend)
      const actorId = req.query.actor_id;
      const actorType = req.query.actor_type as 'user' | 'page' | undefined;
      
      let currentActor;
      if (actorId && actorType) {
        currentActor = await actorRepository.findById(req.tenant.id, actorId);
        if (!currentActor) {
          return reply.status(404).send({ ok: false, message: 'Ator não encontrado' });
        }
      } else {
        // Fallback: usar actor pessoal
        currentActor = await actorRepository.findOrCreateUserActor(
          req.tenant.id,
          user.user_id,
          req.user.globalUserId
        );
      }

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
        req.body.option_index
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
