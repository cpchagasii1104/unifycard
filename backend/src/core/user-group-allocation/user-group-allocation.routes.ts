// backend/src/core/user-group-allocation/user-group-allocation.routes.ts
// ⚠️ O cabeçalho "CONTINUOUS PRODUCTION" acima MENTIA — este módulo é REVOGADO POR LEI. Ver migalha.

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userGroupAllocationService } from './user-group-allocation.service';
import type { SetUserGroupAllocationInput } from './user-group-allocation.service';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — REVOGADO POR LEI (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   docs/01_normative/CONTRATO_GRUPOS_V2.md — declara este módulo "dívida a aposentar"
// ║          e NÃO fonte do rateio comunitário. É LEI, com cláusula "implementação que
// ║          contradiga é BUG por definição". Razão MAIS FORTE que "fora do mínimo": não se
// ║          reabre por decisão de fatia; exige emendar a lei primeiro.
// ║ NÃO:     reabrir estes 2 endpoints. Estavam MONTADOS e VIVOS (unifybank.module.ts:50 →
// ║          /bank/user/group-allocation E /admin/user/group-allocation), com a tabela
// ║          `user_group_allocations` medida AUSENTE. O comentário original dizia
// ║          "CONTINUOUS PRODUCTION" — mentira confirmada, corrigida acima.
// ║ EM VEZ:  o modelo correto é PULL por membership (CONTRATO_GRUPOS_V2). Nada aqui governa
// ║          rateio econômico. NÃO apagar o arquivo — deleção é ato de Clayton.
// ╚════════════════════════════════════════════════════════════════

const setAllocationSchema = z.object({
  allocations: z.array(
    z.object({
      groupId: z.string().uuid(),
      percentage: z.number().min(0).max(100),
    })
  ).max(3),
});

const userGroupAllocationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'user-group-allocation',
    reason: 'revoked_by_law',
    revokedBy: 'docs/01_normative/CONTRATO_GRUPOS_V2.md',
    missingSubstrate: ['user_group_allocations'],
  }));

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








