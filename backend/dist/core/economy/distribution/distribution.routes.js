"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const distribution_service_1 = require("./distribution.service");
const distribution_schemas_1 = require("./distribution.schemas");
const distributionRoutes = async (fastify) => {
    // POST /economy/distribution/auto - Distribuição automática com fees
    fastify.post('/auto', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = distribution_schemas_1.autoDistributeSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await distribution_service_1.distributionService.autoDistribute(tenantId, parsed.data);
            return reply.status(201).send(result);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // POST /economy/distribution/simulate - Simular distribuição (preview)
    fastify.post('/simulate', async (req, reply) => {
        const parsed = distribution_schemas_1.simulateSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const calculation = await distribution_service_1.distributionService.simulateDistribution(parsed.data.amount, parsed.data.config);
        return calculation;
    });
    // POST /economy/distribution/calculate - Calcular fees em lote
    fastify.post('/calculate', async (req, reply) => {
        const parsed = distribution_schemas_1.batchCalculateSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const calculations = await distribution_service_1.distributionService.batchRecalculateFees(parsed.data.amounts, parsed.data.config);
        return { calculations };
    });
    // GET /economy/distribution/config - Buscar configuração de fees
    fastify.get('/config', async (req) => {
        const tenantId = req.tenant.id;
        const config = await distribution_service_1.distributionService.getFeeConfig(tenantId);
        return config;
    });
    // PUT /economy/distribution/config - Atualizar configuração de fees
    fastify.put('/config', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = distribution_schemas_1.feeConfigSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const config = await distribution_service_1.distributionService.updateFeeConfig(tenantId, parsed.data);
            return config;
        }
        catch (error) {
            const err = error;
            return reply.status(501).send({ error: err.message });
        }
    });
};
exports.default = distributionRoutes;
