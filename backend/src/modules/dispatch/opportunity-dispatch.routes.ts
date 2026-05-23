// src/modules/dispatch/opportunity-dispatch.routes.ts
// Rotas do Domínio de DISPATCH DE OPORTUNIDADES
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura, resposta)
// 🔴 BLINDAGEM: NÃO faz matching, NÃO prioriza, NÃO escolhe "melhor"

import { FastifyPluginAsync } from 'fastify';
import { opportunityDispatchService } from './opportunity-dispatch.service';
import { z } from 'zod';
import { OpportunityType, DispatchResponse } from './opportunity-dispatch.types';

const createDispatchSchema = z.object({
  opportunityId: z.string().uuid(), // OBRIGATÓRIO
  opportunityType: z.nativeEnum(OpportunityType), // OBRIGATÓRIO
  targetActorId: z.string().uuid(), // OBRIGATÓRIO
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const respondToDispatchSchema = z.object({
  response: z.nativeEnum(DispatchResponse), // OBRIGATÓRIO
  metadata: z.record(z.any()).optional(),
});

const opportunityDispatchRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /dispatch/opportunities/:id
   * Criar novo dispatch de oportunidade
   * 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
   * 🔴 BLINDAGEM: Apenas NOTIFICA quem PODE atuar
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof createDispatchSchema>;
  }>(
    '/opportunities/:id',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = createDispatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const dispatch = await opportunityDispatchService.createDispatch(
          req.tenant.id,
          req.user.userId,
          {
            opportunityId: req.params.id, // opportunityId vem da URL
            opportunityType: parsed.data.opportunityType, // OBRIGATÓRIO
            targetActorId: parsed.data.targetActorId, // OBRIGATÓRIO
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({
          dispatchId: dispatch.dispatchId,
          opportunityId: dispatch.opportunityId,
          opportunityType: dispatch.opportunityType,
          targetActorId: dispatch.targetActorId,
          dispatchedAt: dispatch.dispatchedAt.toISOString(),
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        if (error instanceof Error) {
          fastify.log.error(error);
          const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
          return reply.status(code ?? 500).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: String(error) });
      }
    }
  );

  /**
   * GET /actors/:id/dispatches
   * Listar dispatches de um actor
   * 🔴 BLINDAGEM: Nenhuma ordenação por score ou prioridade
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      response?: string;
      opportunityType?: string;
    };
  }>('/actors/:id/dispatches', async (req, reply) => {
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const filters: any = {
        targetActorId: req.params.id,
      };

      if (req.query.response) {
        if (req.query.response === 'pending') {
          filters.response = null;
        } else {
          filters.response = req.query.response as DispatchResponse;
        }
      }

      if (req.query.opportunityType) {
        filters.opportunityType = req.query.opportunityType as OpportunityType;
      }

      const dispatches = await opportunityDispatchService.listDispatches(
        req.tenant.id,
        filters
      );

      return reply.send({
        ok: true,
        data: dispatches.map(d => ({
          dispatchId: d.dispatchId,
          opportunityId: d.opportunityId,
          opportunityType: d.opportunityType,
          response: d.response,
          dispatchedAt: d.dispatchedAt.toISOString(),
          respondedAt: d.respondedAt?.toISOString(),
          expiresAt: d.expiresAt?.toISOString(),
        })),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        fastify.log.error(error);
        const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
        return reply.status(code ?? 500).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: String(error) });
    }
  });

  /**
   * POST /dispatch/:dispatchId/respond
   * Responder a um dispatch
   * 🔴 BLINDAGEM: Aceitar não garante nada
   * 🔴 BLINDAGEM: Rejeitar não penaliza
   * 🔴 BLINDAGEM: Expirar não gera score
   */
  fastify.post<{
    Params: { dispatchId: string };
    Body: z.infer<typeof respondToDispatchSchema>;
  }>(
    '/:dispatchId/respond',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = respondToDispatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const dispatch = await opportunityDispatchService.respondToDispatch(
          req.tenant.id,
          req.params.dispatchId,
          req.user.userId,
          {
            response: parsed.data.response, // OBRIGATÓRIO
            metadata: parsed.data.metadata,
          }
        );

        return reply.send({
          dispatchId: dispatch.dispatchId,
          opportunityId: dispatch.opportunityId,
          response: dispatch.response,
          respondedAt: dispatch.respondedAt?.toISOString(),
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        if (error instanceof Error) {
          fastify.log.error(error);
          const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
          return reply.status(code ?? 500).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: String(error) });
      }
    }
  );
};

export { opportunityDispatchRoutes };

