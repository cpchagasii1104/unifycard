"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assistant_service_1 = require("./assistant.service");
const assistant_schemas_1 = require("./assistant.schemas");
const voice_channel_1 = require("./voice.channel");
const plan_gate_service_1 = require("@core/plan/plan-gate.service");
const assistantRoutes = async (fastify) => {
    /**
     * POST /assistant/message
     * Endpoint principal para enviar mensagens ao assistente
     */
    fastify.post('/message', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    channel: { type: 'string', enum: ['chat', 'social', 'voice'] },
                    targetType: { type: 'string', enum: ['user', 'company', 'global'] },
                    targetGlobalUserId: { type: 'string' },
                    targetCompanyId: { type: 'string' },
                    sessionId: { type: 'string' },
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
            const validated = assistant_schemas_1.sendAssistantMessageSchema.parse(req.body);
            const response = await assistant_service_1.assistantService.sendMessage(req.server, {
                tenantId: req.tenant.id,
                globalUserId: req.user.globalUserId,
            }, validated);
            return reply.status(200).send(response);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao processar mensagem do assistente');
            return reply.status(500).send({ error: 'Erro ao processar mensagem do assistente' });
        }
    });
    /**
     * GET /assistant/conversation/:sessionId
     * Busca conversa por sessionId
     */
    fastify.get('/conversation/:sessionId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' },
                },
            },
            querystring: {
                type: 'object',
                properties: {
                    channel: { type: 'string', enum: ['chat', 'social', 'voice'] },
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
            const channel = req.query.channel || 'chat';
            const conversation = await assistant_service_1.assistantService.getConversation(req.server, {
                tenantId: req.tenant.id,
                globalUserId: req.user.globalUserId,
            }, req.params.sessionId, channel);
            return reply.status(200).send(conversation);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(404).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao buscar conversa');
            return reply.status(500).send({ error: 'Erro ao buscar conversa' });
        }
    });
    /**
     * POST /assistant/voice
     * Endpoint para processar áudio de voz
     * Recebe multipart/form-data com arquivo de áudio
     */
    fastify.post('/voice', async (req, reply) => {
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
            // 1. Validar acesso via plan gate
            // Usar userId (local) para buscar plano, fallback para globalUserId
            const userIdForPlan = req.user.id || req.user.globalUserId || '';
            await plan_gate_service_1.planGateService.validateFeatureAccess(req.tenant.id, userIdForPlan, 'voice');
            // 2. Processar multipart/form-data
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: 'Arquivo de áudio não fornecido' });
            }
            // 3. Ler arquivo como buffer
            const audioBuffer = await data.toBuffer();
            const mimeType = data.mimetype || 'audio/webm';
            // 4. Obter campos adicionais do form
            const fields = {};
            if (data.fields) {
                for (const [key, value] of Object.entries(data.fields)) {
                    if (typeof value === 'string') {
                        fields[key] = value;
                    }
                    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'value' in value[0]) {
                        fields[key] = value[0].value;
                    }
                }
            }
            // 5. Processar voz via voice channel
            const result = await voice_channel_1.voiceChannel.processVoice(req.server, {
                audioFile: audioBuffer,
                mimeType,
                userContext: {
                    tenantId: req.tenant.id,
                    globalUserId: req.user.globalUserId,
                },
                sessionId: fields.sessionId,
                targetGlobalUserId: fields.targetGlobalUserId,
                targetCompanyId: fields.targetCompanyId,
            });
            // 6. Retornar resposta
            return reply.status(200).send({
                ok: true,
                data: {
                    text: result.text,
                    transcription: result.transcription,
                    conversation: result.response.conversation,
                    lastMessage: result.response.lastMessage,
                    channel: 'voice',
                    timestamp: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            // Erro de plan gate retorna 403
            if (error instanceof Error && error.message.includes('não disponível')) {
                return reply.status(403).send({
                    ok: false,
                    error: error.message,
                    code: 'FEATURE_NOT_AVAILABLE',
                });
            }
            fastify.log.error({ err: error }, 'Erro ao processar voz');
            return reply.status(500).send({
                ok: false,
                error: error instanceof Error ? error.message : 'Erro ao processar voz',
            });
        }
    });
};
exports.default = assistantRoutes;
//# sourceMappingURL=assistant.routes.js.map