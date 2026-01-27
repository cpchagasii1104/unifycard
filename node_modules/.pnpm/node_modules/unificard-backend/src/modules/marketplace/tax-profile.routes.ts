// backend/src/modules/marketplace/tax-profile.routes.ts
// SPRINT 80: Rotas REST para Tax Profile

import type { FastifyInstance } from 'fastify';
import { taxProfileService } from './tax-profile.service';
import type { SetTaxProfileInput } from './tax-profile.types';

const taxProfileRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /tax-profile
   * Define perfil fiscal
   */
  fastify.post<{ Body: SetTaxProfileInput }>('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const taxProfile = await taxProfileService.setTaxProfile(
      tenantId,
      req.body,
      actionContext.actingUserId
    );

    return reply.status(201).send(taxProfile);
  });

  /**
   * GET /tax-profile
   * Busca perfil fiscal
   */
  fastify.get('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const taxProfile = await taxProfileService.getTaxProfile(tenantId);

    if (!taxProfile) {
      return reply.status(404).send({ error: 'Tax profile não encontrado' });
    }

    return reply.send(taxProfile);
  });

  /**
   * PATCH /tax-profile
   * Atualiza perfil fiscal
   */
  fastify.patch<{ Body: Partial<SetTaxProfileInput> }>('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const taxProfile = await taxProfileService.updateTaxProfile(
      tenantId,
      req.body,
      actionContext.actingUserId
    );

    return reply.send(taxProfile);
  });
};

export default taxProfileRoutes;





