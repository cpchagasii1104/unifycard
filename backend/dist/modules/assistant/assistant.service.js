"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantService = void 0;
const care_service_1 = require("../care/care.service");
const social_actions_service_1 = require("../social-actions/social-actions.service");
const memory_service_1 = require("@core/memory/memory.service");
const assistant_model_1 = require("./assistant.model");
class AssistantService {
    /**
     * Determina o targetType baseado nos parâmetros
     */
    determineTargetType(targetGlobalUserId, targetCompanyId) {
        if (targetCompanyId) {
            return 'company';
        }
        if (targetGlobalUserId) {
            return 'user';
        }
        return 'global';
    }
    /**
     * Envia mensagem e processa via CARE
     */
    async sendMessage(fastify, userContext, input) {
        // 1. Normalizar channel (default 'chat')
        const channel = input.channel || 'chat';
        // 2. Determinar targetType
        const targetType = this.determineTargetType(input.targetGlobalUserId, input.targetCompanyId);
        // 3. Chamar CARE para processar mensagem
        const careResponse = await care_service_1.careService.processUserMessage(fastify, userContext.tenantId, userContext.globalUserId, {
            text: input.text,
            targetGlobalUserId: input.targetGlobalUserId || null,
            targetCompanyId: input.targetCompanyId || null,
            sessionId: input.sessionId || null,
        });
        // 4. Buscar mensagens da sessão
        const sessionWithMessages = await care_service_1.careService.getSession(userContext.tenantId, careResponse.session.careSessionId);
        if (!sessionWithMessages) {
            throw new Error('Sessão não encontrada após processamento');
        }
        // 5. Buscar ações sociais vinculadas à sessão
        let actions = [];
        try {
            // Buscar ações criadas a partir desta sessão (usando sessionId como postId)
            const sessionActions = await social_actions_service_1.socialActionsService.getActionsByPost(userContext.tenantId, careResponse.session.careSessionId);
            actions = sessionActions;
        }
        catch (error) {
            // Silenciosamente ignora erros ao buscar ações
            console.warn('Erro ao buscar ações sociais:', error);
        }
        // 6. Buscar contexto de memória do usuário
        let memoryContext = undefined;
        try {
            const memoryUserContext = await memory_service_1.memoryService.getUserContext(userContext.tenantId, userContext.globalUserId);
            memoryContext = {
                preferences: memoryUserContext.preferences,
                frequentEntities: memoryUserContext.frequentEntities.slice(0, 5), // Top 5
                suggestedShortcuts: memoryUserContext.suggestedShortcuts.slice(0, 5), // Top 5
            };
        }
        catch (error) {
            // Silenciosamente ignora erros ao buscar memória
            console.warn('Erro ao buscar contexto de memória:', error);
        }
        // 7. Montar AssistantConversation
        const conversation = assistant_model_1.AssistantModel.buildConversation(careResponse.session, sessionWithMessages.messages, actions, channel, targetType);
        conversation.memoryContext = memoryContext;
        // 8. Montar lastMessage
        const lastMessage = assistant_model_1.AssistantModel.fromCareMessage(careResponse.message);
        // 9. Atualizar memória se houver execução
        if (careResponse.executionResult && careResponse.executionResult.success) {
            try {
                await memory_service_1.memoryService.updateFromIntent(userContext.tenantId, userContext.globalUserId, {
                    intent: careResponse.session.context.detectedIntents[0]?.intent || '',
                    parameters: careResponse.session.context.detectedIntents[0]?.parameters || {},
                    entityType: input.targetGlobalUserId ? 'worker' : input.targetCompanyId ? 'company' : undefined,
                    entityId: input.targetGlobalUserId || input.targetCompanyId || undefined,
                });
            }
            catch (error) {
                // Silenciosamente ignora erros ao atualizar memória
                console.warn('Erro ao atualizar memória:', error);
            }
        }
        // 10. Montar executedActions se houver execução
        let executedActions = undefined;
        if (careResponse.executionResult) {
            // Se houve execução, buscar a ação executada
            try {
                const executedAction = await social_actions_service_1.socialActionsService.getAction(userContext.tenantId, careResponse.executionResult.actionId || '');
                if (executedAction) {
                    executedActions = [assistant_model_1.AssistantModel.fromSocialAction(executedAction)];
                }
            }
            catch (error) {
                // Silenciosamente ignora erros
            }
        }
        return {
            conversation,
            lastMessage,
            executedActions,
        };
    }
    /**
     * Busca conversa por sessionId
     */
    async getConversation(fastify, userContext, sessionId, channel = 'chat') {
        // 1. Buscar sessão com mensagens via CARE
        const sessionWithMessages = await care_service_1.careService.getSession(userContext.tenantId, sessionId);
        if (!sessionWithMessages) {
            throw new Error('Sessão não encontrada');
        }
        // 2. Determinar targetType
        const targetType = this.determineTargetType(sessionWithMessages.targetGlobalUserId || undefined, sessionWithMessages.targetCompanyId || undefined);
        // 3. Buscar ações sociais vinculadas
        let actions = [];
        try {
            const sessionActions = await social_actions_service_1.socialActionsService.getActionsByPost(userContext.tenantId, sessionId);
            actions = sessionActions;
        }
        catch (error) {
            // Silenciosamente ignora erros
            console.warn('Erro ao buscar ações sociais:', error);
        }
        // 4. Buscar contexto de memória do usuário
        let memoryContext = undefined;
        try {
            const memoryUserContext = await memory_service_1.memoryService.getUserContext(userContext.tenantId, userContext.globalUserId);
            memoryContext = {
                preferences: memoryUserContext.preferences,
                frequentEntities: memoryUserContext.frequentEntities.slice(0, 5),
                suggestedShortcuts: memoryUserContext.suggestedShortcuts.slice(0, 5),
            };
        }
        catch (error) {
            // Silenciosamente ignora erros
            console.warn('Erro ao buscar contexto de memória:', error);
        }
        // 5. Montar AssistantConversation
        const conversation = assistant_model_1.AssistantModel.buildConversation(sessionWithMessages, sessionWithMessages.messages, actions, channel, targetType);
        conversation.memoryContext = memoryContext;
        return conversation;
    }
}
exports.assistantService = new AssistantService();
