"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const account_service_1 = require("./account.service");
const account_schemas_1 = require("./account.schemas");
const zod_1 = require("zod");
// Schema para query params de listagem
const listAccountsQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
    ownerType: zod_1.z.enum(['user', 'merchant', 'community_fund', 'platform_ops', 'group']).optional(),
});
const accountRoutes = async (fastify) => {
    // POST /economy/accounts - Criar nova conta
    fastify.post('/', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = account_schemas_1.createAccountSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const account = await account_service_1.accountService.createAccount(tenantId, parsed.data);
            return reply.status(201).send(account);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // GET /economy/accounts - Listar contas
    fastify.get('/', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = listAccountsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        const { limit, offset, ownerType } = parsed.data;
        return account_service_1.accountService.listAccounts(tenantId, { limit, offset, ownerType });
    });
    // GET /economy/accounts/:accountId - Buscar conta por ID
    fastify.get('/:accountId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = account_schemas_1.accountIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid account ID',
                details: parsed.error.errors,
            });
        }
        const account = await account_service_1.accountService.getAccountById(tenantId, parsed.data.accountId);
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        return account;
    });
    // GET /economy/accounts/:accountId/balance - Buscar saldo
    fastify.get('/:accountId/balance', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsed = account_schemas_1.accountIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid account ID',
                details: parsed.error.errors,
            });
        }
        const account = await account_service_1.accountService.getAccountById(tenantId, parsed.data.accountId);
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        return {
            accountId: account.accountId,
            balance: account.balance,
            currency: account.currency,
        };
    });
    // GET /economy/accounts/owner/:ownerId - Listar contas por owner
    fastify.get('/owner/:ownerId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const parsedParams = account_schemas_1.ownerIdSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return reply.status(400).send({
                error: 'Invalid owner ID',
                details: parsedParams.error.errors,
            });
        }
        const { ownerType } = req.query;
        if (!ownerType) {
            return reply.status(400).send({ error: 'ownerType query parameter is required' });
        }
        const accounts = await account_service_1.accountService.getAccountsByOwner(tenantId, parsedParams.data.ownerId, ownerType);
        return { accounts };
    });
};
exports.default = accountRoutes;
//# sourceMappingURL=account.routes.js.map