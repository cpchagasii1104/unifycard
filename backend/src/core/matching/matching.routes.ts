// src/core/matching/matching.routes.ts
// Rotas para Matching Humano

import { FastifyPluginAsync } from 'fastify';
import { matchingService } from './matching.service';

const matchingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /matching/suggestions
   * Busca sugestões de matching baseadas no estado e afinidade
   */
  fastify.get('/suggestions', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const limit = parseInt((req.query as any).limit || '5', 10);
      const result = await matchingService.getMatchingSuggestions(
        req.tenant.id,
        req.user.id,
        limit
      );
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar sugestões de matching');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar sugestões de matching',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /matching/action
   * Registra ação do usuário sobre uma sugestão (accept ou dismiss)
   */
  fastify.post('/action', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const { matchId, action } = req.body as { matchId: string; action: 'accept' | 'dismiss' };
      
      if (!matchId || !action || (action !== 'accept' && action !== 'dismiss')) {
        return reply.status(400).send({ 
          ok: false, 
          message: 'matchId e action (accept|dismiss) são obrigatórios' 
        });
      }

      await matchingService.recordMatchAction(
        req.tenant.id,
        req.user.id,
        matchId,
        action
      );

      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao registrar ação de matching');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao registrar ação',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
};

export default matchingRoutes;













