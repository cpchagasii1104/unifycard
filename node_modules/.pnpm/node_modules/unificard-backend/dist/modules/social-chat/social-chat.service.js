"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialChatService = void 0;
// src/modules/social-chat/social-chat.service.ts
const uuid_1 = require("uuid");
const social_chat_repository_1 = require("./social-chat.repository");
const social_chat_model_1 = require("./social-chat.model");
const categories_service_1 = require("@core/categories/categories.service");
const orchestrator_service_1 = require("@core/orchestrator/orchestrator.service");
const social_actions_service_1 = require("../social-actions/social-actions.service");
class SocialChatService {
    repository = new social_chat_repository_1.SocialChatRepository();
    /**
     * Transcreve áudio (placeholder para futuro)
     */
    async transcribeAudio(audioUrl) {
        // TODO: Implementar transcrição de áudio real
        // Por enquanto, retorna placeholder
        return `[Áudio transcrito de ${audioUrl}]`;
    }
    /**
     * Envia uma mensagem e processa automaticamente
     */
    async sendMessage(fastify, tenantId, globalUserId, input) {
        // 1. Gerar ou usar conversationId
        const conversationId = input.conversationId || (0, uuid_1.v4)();
        // 2. Processar conteúdo (texto ou áudio)
        let content = input.text || '';
        let rawContent = null;
        if (input.audioUrl && !input.text) {
            // Transcrever áudio (placeholder)
            rawContent = input.audioUrl;
            content = await this.transcribeAudio(input.audioUrl);
        }
        if (!content) {
            throw new Error('Conteúdo da mensagem é obrigatório');
        }
        // 3. Classificar texto em categorias
        const categoryClassifications = await categories_service_1.categoriesService.classifyTextIntoCategories({
            text: content,
            maxCategories: 5,
        });
        const detectedCategories = categoryClassifications.map((c) => c.categoryId);
        // 4. Analisar texto com orchestrator para detectar intent
        let detectedIntent = null;
        let confidence = null;
        let suggestedActions = [];
        try {
            const analysis = await orchestrator_service_1.orchestratorService.analyzeText(fastify, {
                text: content,
                audioUrl: input.audioUrl,
                context: {
                    userId: globalUserId,
                },
            }, globalUserId, tenantId);
            // Pegar intent principal se confiança >= 0.7
            const primaryIntent = analysis.intents[0];
            if (primaryIntent && primaryIntent.confidence >= 0.7) {
                detectedIntent = primaryIntent.intent;
                confidence = primaryIntent.confidence;
                suggestedActions = analysis.suggestedActions || [];
            }
        }
        catch (error) {
            // Silenciosamente ignora erros de análise (não quebra criação da mensagem)
            console.warn('Erro ao analisar intent da mensagem:', error);
        }
        // 5. Criar mensagem no banco
        const row = await this.repository.create({
            conversationId,
            tenantId,
            globalUserId,
            content,
            rawContent,
            media: input.media || [],
            intent: detectedIntent,
            confidence,
            categories: detectedCategories,
            suggestedActions,
            metadata: input.metadata || {},
        });
        const message = social_chat_model_1.SocialChatModel.fromRow(row);
        // 6. Criar ação automaticamente se intent foi detectada
        if (detectedIntent && confidence && confidence >= 0.7) {
            try {
                // Buscar análise novamente para pegar parâmetros
                const analysis = await orchestrator_service_1.orchestratorService.analyzeText(fastify, {
                    text: content,
                    context: {
                        userId: globalUserId,
                    },
                }, globalUserId, tenantId);
                const primaryIntent = analysis.intents[0];
                const parameters = primaryIntent?.parameters || {};
                // Criar ação vinculada à mensagem (usando messageId como postId temporariamente)
                // Em produção, pode criar uma tabela de relacionamento ou usar um campo específico
                await social_actions_service_1.socialActionsService.createAction(tenantId, globalUserId, {
                    postId: message.messageId, // Usando messageId como referência
                    intent: detectedIntent,
                    confidence,
                    parameters,
                });
            }
            catch (error) {
                // Silenciosamente ignora erros ao criar ação
                console.warn('Erro ao criar ação automática da mensagem:', error);
            }
        }
        return message;
    }
    /**
     * Busca mensagem por ID
     */
    async getMessage(tenantId, messageId) {
        const row = await this.repository.findById(tenantId, messageId);
        return row ? social_chat_model_1.SocialChatModel.fromRow(row) : null;
    }
    /**
     * Busca conversa completa com mensagens e ações
     */
    async getConversation(tenantId, conversationId) {
        // Buscar mensagens
        const { rows, total } = await this.repository.findByConversation(tenantId, conversationId);
        const messages = social_chat_model_1.SocialChatModel.fromRows(rows);
        // Buscar ações vinculadas às mensagens desta conversa
        const actions = [];
        for (const message of messages) {
            if (message.intent) {
                try {
                    // Buscar ações criadas a partir desta mensagem
                    // Nota: usando messageId como postId na criação, então buscamos por postId = messageId
                    const messageActions = await social_actions_service_1.socialActionsService.getActionsByPost(tenantId, message.messageId);
                    actions.push(...messageActions.map((action) => ({
                        actionId: action.actionId,
                        intent: action.intent,
                        status: action.status,
                        createdAt: action.createdAt,
                    })));
                }
                catch (error) {
                    // Silenciosamente ignora erros
                }
            }
        }
        return {
            conversationId,
            messages,
            total,
            actions,
        };
    }
}
exports.socialChatService = new SocialChatService();
