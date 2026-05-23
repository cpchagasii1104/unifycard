// backend/src/core/user-group-allocation/user-group-allocation.routes.ts
// CONTINUOUS PRODUCTION: Rotas para alocação de grupos do usuário

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userGroupAllocationService } from './user-group-allocation.service';
import type { SetUserGroupAllocationInput } from './user-group-allocation.service';

const setAllocationSchema = z.object({
  allocations: z.array(
    z.object({
      groupId: z.string().uuid(),
      percentage: z.number().min(0).max(100),
    })
  ).max(3),
});

const userGroupAllocationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /user/group-allocation
   * Obtém alocações de grupos do usuário autenticado
   */
  fastify.get('/group-allocation', async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    try {
      const allocations = await userGroupAllocationService.getUserAllocations(tenantId, userId);
      
      // Sempre retornar array, mesmo se vazio
      // NUNCA lançar erro 500 quando não há alocações
      return reply.status(200).send({
        success: true,
        allocations: Array.isArray(allocations) ? allocations : [],
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error, userId, tenantId }, 'Error fetching user group allocations');
      
      // Em caso de erro, retornar array vazio ao invés de 500
      // Isso permite que criação de eventos funcione mesmo sem contexto financeiro
      return reply.status(200).send({
        success: true,
        allocations: [],
      });
    }
  });

  /**
   * PUT /user/group-allocation
   * Define alocações de grupos do usuário autenticado
   */
  fastify.put('/group-allocation', async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Validar payload
    const parsed = setAllocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const input: SetUserGroupAllocationInput = {
        allocations: parsed.data.allocations.map((a) => ({ groupId: a.groupId, percentage: a.percentage })),
      };
      const allocations = await userGroupAllocationService.setUserAllocations(
        tenantId,
        userId,
        input
      );
      
      return reply.status(200).send({
        success: true,
        allocations,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error, userId, tenantId }, 'Error setting user group allocations');
      
      if (err instanceof z.ZodError || err.message.includes('BadRequest')) {
        return reply.status(400).send({
          error: err.message || 'Invalid request',
        });
      }
      
      return reply.status(500).send({
        error: err.message || 'Failed to set group allocations',
      });
    }
  });
};

export default userGroupAllocationRoutes;








