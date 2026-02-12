"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transaction_schemas_1 = require("./transaction.schemas");
const transactionRoutes = async (fastify) => {
    // POST /economy/transactions/transfer - Executar transferência
    fastify.post('/transfer', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = transaction_schemas_1.createTransferSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await transactionService.transfer(tenantId, parsed.data);
            return reply.status(201).send(result);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // GET /economy/transactions/:transactionId - Buscar por ID
    fastify.get('/:transactionId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = transaction_schemas_1.transactionIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid transaction ID',
                details: parsed.error.errors,
            });
        }
        const transaction = await transactionService.getTransactionById(tenantId, parsed.data.transactionId);
        if (!transaction) {
            return reply.status(404).send({ error: 'Transaction not found' });
        }
        return transaction;
    });
    // GET /economy/transactions/event/:eventId - Buscar por eventId (idempotência)
    fastify.get('/event/:eventId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = transaction_schemas_1.eventIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid event ID',
                details: parsed.error.errors,
            });
        }
        const transaction = await transactionService.getTransactionByEventId(tenantId, parsed.data.eventId);
        if (!transaction) {
            return reply.status(404).send({ error: 'Transaction not found' });
        }
        return transaction;
    });
    // GET /economy/transactions/account/:accountId - Listar por conta
    fastify.get('/account/:accountId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsedParams = transaction_schemas_1.accountIdSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return reply.status(400).send({
                error: 'Invalid account ID',
                details: parsedParams.error.errors,
            });
        }
        const parsedQuery = transaction_schemas_1.listTransactionsQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsedQuery.error.errors,
            });
        }
        const transactions = await transactionService.getTransactionsByAccount(tenantId, parsedParams.data.accountId, parsedQuery.data);
        return { transactions };
    });
};
exports.default = transactionRoutes;
