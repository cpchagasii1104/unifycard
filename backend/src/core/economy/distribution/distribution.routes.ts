// src/core/economy/distribution/distribution.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { distributionService } from './distribution.service';
import {
  autoDistributeSchema,
  simulateSchema,
  batchCalculateSchema,
  feeConfigSchema,
} from './distribution.schemas';

const distributionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /economy/distribution/auto - Distribuição automática com fees
  // @system-context — rota interna de tesouraria. Acesso restrito a workers e admin.
  fastify.post('/auto', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = autoDistributeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const result = await distributionService.autoDistribute(tenantId, {
        fromAccount: parsed.data.fromAccount,
        toAccount: parsed.data.toAccount,
        amountCents: parsed.data.amountCents,
        groupAccount: parsed.data.groupAccount,
        config: parsed.data.config,
      });
      return reply.status(201).send(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

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
