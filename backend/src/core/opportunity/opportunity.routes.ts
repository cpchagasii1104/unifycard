// src/core/opportunity/opportunity.routes.ts
// Rotas para Oportunidades Suaves

import { FastifyPluginAsync } from 'fastify';
import {
  isSemanticResolutionError,
  replySemanticResolutionFailure,
} from '@core/semantic/semantic-http';
import { opportunityService } from './opportunity.service';

const opportunityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /opportunities/contextual
   * Busca oportunidades contextuais baseadas no estado e progresso
   * REGRA: Só retorna se condições forem atendidas
   */
  fastify.get('/contextual', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const limit = parseInt((req.query as any).limit || '3', 10);
      const result = await opportunityService.getContextualOpportunities(
        req.tenant.id,
        req.user.id,
        limit
      );
      return reply.send({ ok: true, data: result });
    } catch (error) {
      if (isSemanticResolutionError(error)) {
        return replySemanticResolutionFailure(reply, error);
      }
      fastify.log.error({ err: error }, 'Erro ao buscar oportunidades contextuais');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar oportunidades contextuais',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /opportunities/action
   * Registra ação do usuário sobre uma oportunidade (accept ou dismiss)
   */
  fastify.post('/action', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const { opportunityId, action } = req.body as { opportunityId: string; action: 'accept' | 'dismiss' };
      
      if (!opportunityId || !action || (action !== 'accept' && action !== 'dismiss')) {
        return reply.status(400).send({ 
          ok: false, 
          message: 'opportunityId e action (accept|dismiss) são obrigatórios' 
        });
      }

      await opportunityService.recordOpportunityAction(
        req.tenant.id,
        req.user.id,
        opportunityId,
        action
      );

      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao registrar ação de oportunidade');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao registrar ação',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
};

export default opportunityRoutes;


























