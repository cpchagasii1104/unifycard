"use strict";
// backend/src/core/unifybank/transparency.routes.ts
// Rotas de Transparência Financeira - FASE 6
// Endpoints para extratos, splits e fundos regionais
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const transparency_service_1 = require("./transparency.service");
const identity_utils_1 = require("@core/identity/identity.utils");
// Schemas de validação
const statementQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
});
const regionalFundQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
});
const adminRegionalFundQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional().default(100),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
});
const transparencyRoutes = async (fastify) => {
    /**
     * GET /bank/statement
     * Obtém extrato financeiro do usuário autenticado
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * globalUserId vem da sessão
     *
     * Query params:
     * - limit: número de itens (default: 50, max: 100)
     * - offset: paginação (default: 0)
     * - startDate: data inicial (opcional)
     * - endDate: data final (opcional)
     *
     * Respostas:
     * - 200: Extrato retornado com sucesso
     * - 401: Não autenticado
     * - 500: Erro inesperado
     */
    fastify.get('/statement', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        // 2. Resolver globalUserId
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // 3. Validar query params
        const parsed = statementQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await transparency_service_1.transparencyService.getUserStatement(tenantId, globalUserId, {
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
            });
            return reply.status(200).send({
                success: true,
                statement: result,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error fetching user statement');
            return reply.status(500).send({
                error: err.message || 'Failed to fetch statement',
            });
        }
    });
    /**
     * GET /bank/transaction/:transactionId/splits
     * Obtém detalhe de split de uma transação base
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     *
     * Respostas:
     * - 200: Detalhe de split retornado
     * - 401: Não autenticado
     * - 404: Transação não encontrada ou sem split
     * - 500: Erro inesperado
     */
    fastify.get('/transaction/:transactionId/splits', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const { transactionId } = req.params;
        // 2. Validar transactionId
        if (!transactionId || typeof transactionId !== 'string') {
            return reply.status(400).send({ error: 'Invalid transaction ID' });
        }
        try {
            const result = await transparency_service_1.transparencyService.getTransactionSplits(tenantId, transactionId);
            if (!result) {
                return reply.status(404).send({ error: 'Transaction not found' });
            }
            return reply.status(200).send({
                success: true,
                splitDetail: result,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error fetching transaction splits');
            return reply.status(500).send({
                error: err.message || 'Failed to fetch split detail',
            });
        }
    });
    /**
     * GET /bank/regional-fund
     * Obtém visão do fundo regional para o usuário autenticado
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     *
     * Query params:
     * - limit: número de itens (default: 50, max: 100)
     * - offset: paginação (default: 0)
     *
     * Respostas:
     * - 200: Fundo regional retornado
     * - 401: Não autenticado
     * - 404: Fundo regional não encontrado para o usuário
     * - 500: Erro inesperado
     */
    fastify.get('/regional-fund', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        // 2. Resolver globalUserId
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // 3. Validar query params
        const parsed = regionalFundQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await transparency_service_1.transparencyService.getUserRegionalFund(tenantId, globalUserId, {
                limit: parsed.data.limit,
                offset: parsed.data.offset,
            });
            if (!result) {
                return reply.status(404).send({
                    error: 'Regional fund not found for this user',
                });
            }
            return reply.status(200).send({
                success: true,
                regionalFund: result,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error fetching regional fund');
            return reply.status(500).send({
                error: err.message || 'Failed to fetch regional fund',
            });
        }
    });
};
exports.default = transparencyRoutes;
//# sourceMappingURL=transparency.routes.js.map