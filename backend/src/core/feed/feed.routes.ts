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

    // 🔴 DECISION-0113 F6.5.4 (CRA): o feed contextual é PERSONALIZADO (estado inferido do actor). O
    // `actionContext.actorId` é spoofável → provar que o `req.user` pode REPRESENTAR esse actor ANTES de
    // ler o feed pessoal alheio. fail-closed → 401 (sem auth) / 403 (não representável) não-leak. Não altera
    // ranking/algoritmo/semântica/filtros do feed — só impede ler o feed de OUTRO actor.
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório' });
    }
    let canReadFeed = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadFeed = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch {
      canReadFeed = false;
    }
    if (!canReadFeed) {
      return reply.status(403).send({ ok: false, message: 'Actor não representável pelo usuário autenticado' });
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
   *
   * 🔴 F-G10-C1-PRECONDITION (DECISION-0115 D1): no tenant inicial COMPARTILHADO, RLS é por tenant,
   * não por actor/user — leituras tenant-wide vazam. Decisão de produto (GO IA Diretora/Clayton):
   * `groups` é MEMBER-SCOPED via group_members (sujeito = req.user server-side; DECISION-0113);
   * `services` conta apenas conteúdo público; `feed`/`events` continuam tenant-wide públicos por enquanto.
   */
  fastify.get('/unread-counts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.userId;

    // F-C1-AUTO-REACHABLE-READ-PURITY: erro estrutural NÃO vira ZERO FALSO. Cada contador é
    // isolado; falha (ex.: a query legada de `feed` referencia `posts.visibility`, coluna fantasma —
    // DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN) retorna **null** (indisponível/honesto), NÃO 0.
    const countOrNull = async (counter: string, sql: string, params: unknown[]): Promise<number | null> => {
      try {
        const row = await runQueryWithTenant<{ count: string }>(tenantId, sql, params);
        return row ? Number(row.count) : 0;
      } catch (error) {
        fastify.log.error({ err: error, tenantId, counter }, 'Contador de novidade indisponível (erro estrutural)');
        return null; // indisponível — NUNCA zero falso
      }
    };

    // Feed: posts das últimas 24h (INTOCADO — tenant-wide público por decisão de produto)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const feed = await countOrNull(
      'feed',
      `
      SELECT COUNT(*)::int as count
      FROM posts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND visibility = 'PUBLIC'
      `,
      [tenantId, oneDayAgo]
    );

    // Grupos: MEMBER-SCOPED via group_members — atividade de grupo só conta para quem é membro;
    // não vaza existência/atividade de grupos alheios no tenant compartilhado
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups = await countOrNull(
      'groups',
      `
      SELECT COUNT(DISTINCT p.metadata->>'groupId')::int as count
      FROM posts p
      INNER JOIN group_members gm
        ON gm.tenant_id = p.tenant_id
       AND gm.group_id::text = p.metadata->>'groupId'
      WHERE p.tenant_id = $1
        AND p.metadata->>'groupId' IS NOT NULL
        AND p.created_at >= $2
        AND p.is_published = true
        AND p.is_deleted = false
        AND gm.user_id = $3
      `,
      [tenantId, sevenDaysAgo, userId]
    );

    // Eventos: eventos próximos (INTOCADO — tenant-wide público por decisão de produto)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const events = await countOrNull(
      'events',
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

    // Serviços: apenas conteúdo PÚBLICO — publicado, não deletado e fora de grupo (o schema vivo de
    // posts não tem `visibility` por post; a fronteira não-pública materializada hoje é o grupo)
    const services = await countOrNull(
      'services',
      `
      SELECT COUNT(*)::int as count
      FROM posts
      WHERE tenant_id = $1
        AND intent = 'service_offer'
        AND created_at >= $2
        AND is_published = true
        AND is_deleted = false
        AND metadata->>'groupId' IS NULL
      `,
      [tenantId, sevenDaysAgo]
    );

    return { feed, groups, events, services };
  });
};

export default feedRoutes;




