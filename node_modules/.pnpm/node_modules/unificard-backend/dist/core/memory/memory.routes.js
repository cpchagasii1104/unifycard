"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memory_service_1 = require("./memory.service");
const memory_schemas_1 = require("./memory.schemas");
const memoryRoutes = async (fastify) => {
    /**
     * GET /memory/preferences
     * Busca preferências do usuário
     */
    fastify.get('/preferences', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    category: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const preferences = await memory_service_1.memoryService.getUserPreferences(req.tenant.id, req.user.globalUserId, req.query.category);
            return preferences;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar preferências');
            return reply.status(500).send({ error: 'Erro ao buscar preferências' });
        }
    });
    /**
     * GET /memory/suggested-actions
     * Busca ações sugeridas (shortcuts)
     */
    fastify.get('/suggested-actions', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const actions = await memory_service_1.memoryService.getSuggestedActions(req.tenant.id, req.user.globalUserId);
            return { actions };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar ações sugeridas');
            return reply.status(500).send({ error: 'Erro ao buscar ações sugeridas' });
        }
    });
    /**
     * GET /memory/context
     * Busca contexto completo do usuário
     */
    fastify.get('/context', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const context = await memory_service_1.memoryService.getUserContext(req.tenant.id, req.user.globalUserId);
            return context;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar contexto do usuário');
            return reply.status(500).send({ error: 'Erro ao buscar contexto do usuário' });
        }
    });
    /**
     * POST /memory/update-from-intent
     * Atualiza memória a partir de uma intent executada
     */
    fastify.post('/update-from-intent', {
        schema: {
            body: {
                type: 'object',
                required: ['intent', 'parameters'],
                properties: {
                    intent: { type: 'string' },
                    parameters: { type: 'object' },
                    entityType: { type: 'string' },
                    entityId: { type: 'string' },
                    entityName: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = memory_schemas_1.updateFromIntentSchema.parse(req.body);
            await memory_service_1.memoryService.updateFromIntent(req.tenant.id, req.user.globalUserId, validated);
            return reply.status(200).send({ success: true });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao atualizar memória');
            return reply.status(500).send({ error: 'Erro ao atualizar memória' });
        }
    });
    /**
     * POST /memory/register-interaction
     * Registra interação com entidade
     */
    fastify.post('/register-interaction', {
        schema: {
            body: {
                type: 'object',
                required: ['entityId', 'entityType'],
                properties: {
                    entityId: { type: 'string' },
                    entityType: { type: 'string' },
                    entityName: { type: 'string' },
                    metadata: { type: 'object' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = memory_schemas_1.registerInteractionSchema.parse(req.body);
            await memory_service_1.memoryService.registerInteraction(req.tenant.id, req.user.globalUserId, validated);
            return reply.status(200).send({ success: true });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao registrar interação');
            return reply.status(500).send({ error: 'Erro ao registrar interação' });
        }
    });
};
exports.default = memoryRoutes;
//# sourceMappingURL=memory.routes.js.map