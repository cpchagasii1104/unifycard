// src/core/feed/feed.routes.ts
// Rotas para Feed Contextual

import { FastifyPluginAsync } from 'fastify';
import {
  isSemanticResolutionError,
  replySemanticResolutionFailure,
} from '@core/semantic/semantic-http';
import { feedService } from './feed.service';
import { resolveGlobalUserId } from '../identity/identity.utils';
import { runQueryWithTenant } from '../database/pool';

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /feed/contextual
   * Busca feed contextual baseado no estado inferido do usuário
   */
  fastify.get('/contextual', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const limit = parseInt((req.query as any).limit || '20', 10);
      const feed = await feedService.getContextualFeed(
        req.tenant.id,
        req.actionContext.actorId,
        limit
      );
      return reply.send({ ok: true, data: feed });
    } catch (error) {
      if (isSemanticResolutionError(error)) {
        return replySemanticResolutionFailure(reply, error);
      }
      fastify.log.error({ err: error }, 'Erro ao buscar feed contextual');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar feed contextual',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /feed/action
   * Registra ação do usuário sobre um conteúdo (like, dislike, save, ignore)
   */
  fastify.post('/action', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const { contentId, action } = req.body as { 
        contentId: string; 
        action: 'like' | 'dislike' | 'save' | 'ignore' 
      };
      
      if (!contentId || !action || !['like', 'dislike', 'save', 'ignore'].includes(action)) {
        return reply.status(400).send({ 
          ok: false, 
          message: 'contentId e action (like|dislike|save|ignore) são obrigatórios' 
        });
      }

      // ActionContext é obrigatório
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const actorId = req.actionContext.actorId;

      // Resolver globalUserId a partir do actorId (se necessário para o service)
      // TODO: Refatorar feedService para usar actorId diretamente
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(req.tenant.id, actorId);
      if (!actor || !actor.user_id) {
        return reply.status(404).send({ ok: false, message: 'Actor não encontrado' });
      }
      const globalUserId = await resolveGlobalUserId(actor.user_id, req.tenant.id);

      await feedService.recordContentAction(
        req.tenant.id,
        globalUserId,
        contentId,
        action
      );

      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao registrar ação de conteúdo');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao registrar ação',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /feed/unread-counts
   * Retorna contadores de novidade para o menu social
   * 
   * HEURÍSTICA ATUAL (temporária):
   * - Feed: posts das últimas 24h (visibilidade pública)
   * - Grupos: grupos com atividade recente (últimos 7 dias)
   * - Eventos: eventos próximos (próximos 7 dias, status published/active)
   * - Serviços: ofertas de serviço recentes (últimos 7 dias)
   * 
   * TODO: Substituir por sistema de "lidos/não lidos" quando implementado
   */
  fastify.get('/unread-counts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;

    try {
      // Feed: posts das últimas 24h
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const feedCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND created_at >= $2
          AND visibility = 'PUBLIC'
        `,
        [tenantId, oneDayAgo]
      );

      // Grupos: grupos com atividade recente (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const groupsCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(DISTINCT metadata->>'groupId')::int as count
        FROM posts
        WHERE tenant_id = $1
          AND metadata->>'groupId' IS NOT NULL
          AND created_at >= $2
        `,
        [tenantId, sevenDaysAgo]
      );

      // Eventos: eventos próximos (próximos 7 dias)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const eventsCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM events
        WHERE tenant_id = $1
          AND status IN ('published', 'active')
          AND datetime_start IS NOT NULL
          AND datetime_start >= NOW()
          AND datetime_start <= $2
        `,
        [tenantId, sevenDaysFromNow]
      );

      // Serviços: ofertas de serviço recentes (últimos 7 dias)
      const servicesCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND intent = 'service_offer'
          AND created_at >= $2
        `,
        [tenantId, sevenDaysAgo]
      );

      return {
        feed: feedCount ? Number(feedCount.count) : 0,
        groups: groupsCount ? Number(groupsCount.count) : 0,
        events: eventsCount ? Number(eventsCount.count) : 0,
        services: servicesCount ? Number(servicesCount.count) : 0,
      };
    } catch (error) {
      fastify.log.error({ err: error, tenantId }, 'Erro ao buscar contadores de novidade');
      // Retornar zeros em caso de erro (não quebrar UI)
      return {
        feed: 0,
        groups: 0,
        events: 0,
        services: 0,
      };
    }
  });
};

export default feedRoutes;




