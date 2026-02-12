"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const social_actions_service_1 = require("./social-actions.service");
const social_actions_schemas_1 = require("./social-actions.schemas");
const socialActionsRoutes = async (fastify) => {
    /**
     * POST /social-actions/execute
     * Executa uma ação
     */
    fastify.post('/execute', {
        schema: {
            body: {
                type: 'object',
                required: ['actionId'],
                properties: {
                    actionId: { type: 'string' },
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
            const validated = social_actions_schemas_1.executeActionSchema.parse(req.body);
            const result = await social_actions_service_1.socialActionsService.executeAction(req.server, req.tenant.id, validated.actionId, req.user.globalUserId);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao executar ação');
            return reply.status(500).send({ error: 'Erro ao executar ação' });
        }
    });
    /**
     * GET /social-actions/:actionId
     * Busca uma ação por ID
     */
    fastify.get('/:actionId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    actionId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const action = await social_actions_service_1.socialActionsService.getAction(req.tenant.id, req.params.actionId);
            if (!action) {
                return reply.status(404).send({ error: 'Ação não encontrada' });
            }
            return action;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar ação');
            return reply.status(500).send({ error: 'Erro ao buscar ação' });
        }
    });
    /**
     * GET /social-actions/by-post/:postId
     * Busca todas as ações de um post
     */
    fastify.get('/by-post/:postId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    postId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const actions = await social_actions_service_1.socialActionsService.getActionsByPost(req.tenant.id, req.params.postId);
            return { actions, totalCents: actions.length };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar ações do post');
            return reply.status(500).send({ error: 'Erro ao buscar ações do post' });
        }
    });
    /**
     * POST /social-actions/:actionId/cancel
     * Cancela uma ação
     */
    fastify.post('/:actionId/cancel', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    actionId: { type: 'string' },
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
            await social_actions_service_1.socialActionsService.cancelAction(req.tenant.id, req.params.actionId, req.user.globalUserId);
            return reply.status(200).send({ success: true, message: 'Ação cancelada' });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao cancelar ação');
            return reply.status(500).send({ error: 'Erro ao cancelar ação' });
        }
    });
};
exports.default = socialActionsRoutes;
