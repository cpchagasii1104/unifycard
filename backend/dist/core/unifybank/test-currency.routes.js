"use strict";
// src/core/unifybank/test-currency.routes.ts
//
// Rotas administrativas para gerenciar moeda fictícia de teste (TEST)
// Apenas role 'admin' pode acessar
Object.defineProperty(exports, "__esModule", { value: true });
const test_currency_service_1 = require("./test-currency.service");
const zod_1 = require("zod");
const emitTestCurrencySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
    amount: zod_1.z.number().positive('Amount must be positive').max(1000000, 'Maximum amount is 1,000,000'),
    reason: zod_1.z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});
const testCurrencyRoutes = async (fastify) => {
    /**
     * POST /admin/test-currency/emit
     * Emite saldo fictício (TEST) para um usuário
     * Apenas ADMIN pode emitir
     */
    fastify.post('/emit', {
        schema: {
            body: {
                type: 'object',
                required: ['userId', 'amount', 'reason'],
                properties: {
                    userId: { type: 'string', format: 'uuid' },
                    amount: { type: 'number', minimum: 0.01, maximum: 1000000 },
                    reason: { type: 'string', minLength: 1, maxLength: 500 },
                },
            },
        },
        preHandler: async (req, reply) => {
            // Validar role admin
            await fastify.requireRole(['admin'])(req, reply);
        },
    }, async (req, reply) => {
        if (!req.user || !req.tenant) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        const parsed = emitTestCurrencySchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                ok: false,
                message: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await test_currency_service_1.testCurrencyService.emitTestCurrency({
                tenantId: req.tenant.id,
                userId: parsed.data.userId,
                amount: parsed.data.amount,
                reason: parsed.data.reason,
                adminId: req.user.id,
            });
            return reply.status(201).send({
                ok: true,
                data: result,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao emitir moeda de teste');
            return reply.status(500).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao emitir moeda de teste',
            });
        }
    });
    /**
     * GET /admin/test-currency/ledger
     * Lista emissões de TEST para um usuário
     * Apenas ADMIN pode acessar
     */
    fastify.get('/ledger', {
        schema: {
            querystring: {
                type: 'object',
                required: ['userId'],
                properties: {
                    userId: { type: 'string', format: 'uuid' },
                    limit: { type: 'number', minimum: 1, maximum: 100 },
                    offset: { type: 'number', minimum: 0 },
                },
            },
        },
        preHandler: async (req, reply) => {
            // Validar role admin
            await fastify.requireRole(['admin'])(req, reply);
        },
    }, async (req, reply) => {
        if (!req.user || !req.tenant) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const result = await test_currency_service_1.testCurrencyService.getTestCurrencyLedger(req.tenant.id, req.query.userId, req.query.limit || 50, req.query.offset || 0);
            return reply.send({
                ok: true,
                data: result,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar ledger de moeda de teste');
            return reply.status(500).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao buscar ledger de moeda de teste',
            });
        }
    });
};
exports.default = testCurrencyRoutes;
//# sourceMappingURL=test-currency.routes.js.map