// src/core/economy/distribution/distribution.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { distributionService } from './distribution.service';
import {
  simulateSchema,
  batchCalculateSchema,
  feeConfigSchema,
} from './distribution.schemas';

const distributionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /economy/distribution/simulate - Simular distribuição (preview)
  fastify.post('/simulate', async (req, reply) => {
    const parsed = simulateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const calculation = await distributionService.simulateDistribution(
      parsed.data.amountCents,
      parsed.data.config
    );
    return calculation;
  });

  // POST /economy/distribution/calculate - Calcular fees em lote
  fastify.post('/calculate', async (req, reply) => {
    const parsed = batchCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const calculations = await distributionService.batchRecalculateFees(
      parsed.data.amounts,
      parsed.data.config
    );
    return { calculations };
  });

  // GET /economy/distribution/config - Buscar configuração de fees
  fastify.get('/config', async (req) => {
    const tenantId = req.tenant!.id;
    const config = await distributionService.getFeeConfig(tenantId);
    return config;
  });

  // PUT /economy/distribution/config - Atualizar configuração de fees
  fastify.put('/config', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = feeConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const config = await distributionService.updateFeeConfig(tenantId, parsed.data);
      return config;
    } catch (error) {
      const err = error as Error;
      return reply.status(501).send({ error: err.message });
    }
  });
};

export default distributionRoutes;
