"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const social_chat_service_1 = require("./social-chat.service");
const social_chat_schemas_1 = require("./social-chat.schemas");
const socialChatRoutes = async (fastify) => {
    /**
     * POST /social-chat/send-message
     * Envia uma mensagem e processa automaticamente (intent, categorias, ações)
     */
    fastify.post('/send-message', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    conversationId: { type: 'string' },
                    text: { type: 'string' },
                    audioUrl: { type: 'string' },
                    media: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['image', 'video', 'audio'] },
                                url: { type: 'string' },
                                thumbnailUrl: { type: 'string' },
                                duration: { type: 'number' },
                                metadata: { type: 'object' },
                            },
                        },
                    },
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
            const validated = social_chat_schemas_1.sendMessageSchema.parse(req.body);
            const message = await social_chat_service_1.socialChatService.sendMessage(req.server, req.tenant.id, req.user.globalUserId, validated);
            return reply.status(201).send(message);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao enviar mensagem');
            return reply.status(500).send({ error: 'Erro ao enviar mensagem' });
        }
    });
    /**
     * GET /social-chat/conversation/:id
     * Retorna conversa completa com mensagens e ações vinculadas
     */
    fastify.get('/conversation/:id', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
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
            const conversation = await social_chat_service_1.socialChatService.getConversation(req.tenant.id, req.params.id);
            return conversation;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar conversa');
            return reply.status(500).send({ error: 'Erro ao buscar conversa' });
        }
    });
    /**
     * GET /social-chat/message/:messageId
     * Busca uma mensagem específica
     */
    fastify.get('/message/:messageId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    messageId: { type: 'string' },
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
            const message = await social_chat_service_1.socialChatService.getMessage(req.tenant.id, req.params.messageId);
            if (!message) {
                return reply.status(404).send({ error: 'Mensagem não encontrada' });
            }
            return message;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar mensagem');
            return reply.status(500).send({ error: 'Erro ao buscar mensagem' });
        }
    });
};
exports.default = socialChatRoutes;
