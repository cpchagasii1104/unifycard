"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.careService = void 0;
const care_repository_1 = require("./care.repository");
const care_model_1 = require("./care.model");
const social_chat_service_1 = require("../social-chat/social-chat.service");
const orchestrator_service_1 = require("@core/orchestrator/orchestrator.service");
const schedule_service_1 = require("../schedule/schedule.service");
const social_actions_service_1 = require("../social-actions/social-actions.service");
class CareService {
    repository = new care_repository_1.CareRepository();
    /**
     * Cria ou recupera sessão
     */
    async getOrCreateSession(fastify, tenantId, globalUserId, targetGlobalUserId, targetCompanyId) {
        // Buscar sessão ativa existente
        const existing = await this.repository.findActiveSession(tenantId, globalUserId, targetGlobalUserId, targetCompanyId);
        if (existing) {
            return care_model_1.CareModel.fromRow(existing);
        }
        // Criar contexto inicial
        const context = {
            detectedIntents: [],
            categories: [],
            suggestedActions: [],
            conversationHistory: [],
        };
        // Carregar contexto inicial com AI Kernel
        try {
            const aiContext = await fastify.ai.getContext();
            if (aiContext) {
                // Adicionar informações de contexto do usuário
                context.conversationHistory.push({
                    role: 'system',
                    content: 'Sessão iniciada',
                    timestamp: new Date(),
                });
            }
        }
        catch (error) {
            // Silenciosamente ignora erros
        }
        // Criar estado inicial
        const state = {
            missingParameters: [],
            askedQuestions: [],
            pendingActions: [],
            isReadyToExecute: false,
            executionAttempts: 0,
        };
        // Criar nova sessão
        const row = await this.repository.createSession({
            tenantId,
            globalUserId,
            targetGlobalUserId,
            targetCompanyId,
            state,
            context,
        });
        return care_model_1.CareModel.fromRow(row);
    }
    /**
     * Processa mensagem do usuário
     */
    async processUserMessage(fastify, tenantId, globalUserId, input) {
        // 1. Buscar ou criar sessão
        const session = await this.getOrCreateSession(fastify, tenantId, globalUserId, input.targetGlobalUserId, input.targetCompanyId);
        // 2. Salvar mensagem do usuário
        const userMessageRow = await this.repository.createMessage({
            tenantId,
            careSessionId: session.careSessionId,
            isFromUser: true,
            content: input.text,
        });
        const userMessage = care_model_1.CareMessageModel.fromRow(userMessageRow);
        // 3. Analisar mensagem usando SCI (Social Chat Intelligence)
        let detectedIntent = null;
        let confidence = null;
        let parameters = {};
        let suggestedActions = [];
        let detectedCategories = [];
        try {
            // Usar SCI para analisar
            const sciMessage = await social_chat_service_1.socialChatService.sendMessage(fastify, tenantId, globalUserId, {
                text: input.text,
                conversationId: session.careSessionId,
            });
            detectedIntent = sciMessage.intent || null;
            confidence = sciMessage.confidence || null;
            suggestedActions = sciMessage.suggestedActions || [];
            detectedCategories = sciMessage.categories || [];
            // Se não detectou intent, tentar via orchestrator diretamente
            if (!detectedIntent) {
                const analysis = await orchestrator_service_1.orchestratorService.analyzeText(fastify, {
                    text: input.text,
                    context: {
                        userId: globalUserId,
                    },
                }, globalUserId, tenantId);
                const primaryIntent = analysis.intents[0];
                if (primaryIntent && primaryIntent.confidence >= 0.5) {
                    detectedIntent = primaryIntent.intent;
                    confidence = primaryIntent.confidence;
                    parameters = primaryIntent.parameters || {};
                }
            }
        }
        catch (error) {
            // Silenciosamente ignora erros de análise
            console.warn('Erro ao analisar mensagem:', error);
        }
        // 4. Atualizar contexto da sessão
        const updatedContext = {
            ...session.context,
            detectedIntents: [
                ...(session.context.detectedIntents || []),
                ...(detectedIntent ? [{ intent: detectedIntent, confidence: confidence || 0, parameters }] : []),
            ],
            categories: [...new Set([...session.context.categories, ...detectedCategories])],
            suggestedActions: [...(session.context.suggestedActions || []), ...suggestedActions],
            conversationHistory: [
                ...(session.context.conversationHistory || []),
                {
                    role: 'user',
                    content: input.text,
                    timestamp: new Date(),
                },
            ],
        };
        // 5. Detectar dados faltantes e atualizar estado
        const updatedState = await this.detectMissingParameters(fastify, detectedIntent, parameters, session.state, updatedContext);
        // 6. Verificar disponibilidade de horários se for schedule_service
        if (detectedIntent === 'schedule_service' && parameters.workerId) {
            try {
                const schedule = await schedule_service_1.scheduleService.getOrCreateUserSchedule(tenantId, parameters.workerId);
                const scheduleWithSlots = await schedule_service_1.scheduleService.getScheduleWithSlots(tenantId, schedule.scheduleId, {
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
                });
                updatedContext.scheduleAvailability = {
                    workerId: parameters.workerId,
                    availableSlots: (scheduleWithSlots?.slots || [])
                        .filter((s) => s.status === 'available')
                        .map((s) => ({
                        startTime: s.startTime,
                        endTime: s.endTime,
                        slotId: s.slotId,
                    })),
                };
            }
            catch (error) {
                // Silenciosamente ignora erros
            }
        }
        // 7. Gerar resposta do AI
        const aiResponse = await this.generateAIResponse(fastify, session, input.text, detectedIntent, updatedState, updatedContext);
        // 8. Salvar mensagem do sistema
        const systemMessageRow = await this.repository.createMessage({
            tenantId,
            careSessionId: session.careSessionId,
            isFromUser: false,
            content: aiResponse.content,
            intent: detectedIntent,
            parameters: Object.keys(parameters).length > 0 ? parameters : null,
            aiReasoning: aiResponse.reasoning,
        });
        const systemMessage = care_model_1.CareMessageModel.fromRow(systemMessageRow);
        // 9. Atualizar sessão
        await this.repository.updateSession(tenantId, session.careSessionId, {
            lastMessage: input.text,
            state: updatedState,
            context: updatedContext,
        });
        // 10. Executar intent se estiver pronto
        let executionResult = null;
        if (updatedState.isReadyToExecute && detectedIntent) {
            try {
                // Criar ação social
                const action = await social_actions_service_1.socialActionsService.createAction(tenantId, globalUserId, {
                    postId: session.careSessionId, // Usando sessionId como referência
                    intent: detectedIntent,
                    confidence: confidence || 0.7,
                    parameters,
                });
                // Executar ação
                const executeResult = await social_actions_service_1.socialActionsService.executeAction(fastify, tenantId, action.actionId, globalUserId);
                executionResult = executeResult;
                updatedState.executionAttempts = (updatedState.executionAttempts || 0) + 1;
                updatedState.isReadyToExecute = false; // Reset após execução
            }
            catch (error) {
                console.warn('Erro ao executar intent:', error);
            }
        }
        // 11. Buscar sessão atualizada
        const updatedSessionRow = await this.repository.findSessionById(tenantId, session.careSessionId);
        const updatedSession = updatedSessionRow ? care_model_1.CareModel.fromRow(updatedSessionRow) : session;
        return {
            session: updatedSession,
            message: systemMessage,
            aiResponse,
            isReadyToExecute: updatedState.isReadyToExecute,
            executionResult,
        };
    }
    /**
     * Detecta parâmetros faltantes
     */
    async detectMissingParameters(fastify, intent, parameters, currentState, context) {
        const missing = [];
        const asked = currentState.askedQuestions || [];
        if (!intent) {
            return {
                ...currentState,
                missingParameters: [],
                isReadyToExecute: false,
            };
        }
        // Definir parâmetros obrigatórios por intent
        const requiredParams = {
            schedule_service: ['workerId', 'date', 'time'],
            hire_service: ['workerId', 'serviceId'],
            buy_product: ['productId', 'quantity'],
            request_ride: ['origin', 'destination'],
            book_event: ['eventId', 'quantity'],
            order_food: ['restaurantId', 'items'],
        };
        const required = requiredParams[intent] || [];
        for (const param of required) {
            if (!parameters[param] && !asked.includes(param)) {
                missing.push(param);
            }
        }
        const isReady = missing.length === 0 && required.length > 0;
        return {
            ...currentState,
            missingParameters: missing,
            askedQuestions: asked,
            currentIntent: intent,
            isReadyToExecute: isReady,
        };
    }
    /**
     * Gera resposta do AI
     */
    async generateAIResponse(fastify, session, userMessage, detectedIntent, state, context) {
        // Usar AI Kernel para gerar resposta
        const prompt = `
Analise a conversa e gere uma resposta natural e útil.

Contexto:
- Mensagem do usuário: "${userMessage}"
- Intent detectada: ${detectedIntent || 'nenhuma'}
- Parâmetros faltantes: ${state.missingParameters.join(', ') || 'nenhum'}
- Histórico: ${context.conversationHistory.length} mensagens

Gere uma resposta que:
1. Seja natural e conversacional
2. Pergunte pelos dados faltantes se necessário
3. Sugira próximos passos
4. Seja útil e direta
`;
        try {
            const aiResult = await fastify.ai.run(prompt, {
                session,
                userMessage,
                detectedIntent,
                state,
                context,
            });
            return {
                content: aiResult.result || aiResult.thought?.result || this.generateFallbackResponse(state, detectedIntent),
                reasoning: aiResult.thought || {},
                nextSteps: state.missingParameters.map((p) => `Preciso saber: ${p}`),
                suggestedActions: context.suggestedActions || [],
            };
        }
        catch (error) {
            // Fallback se AI Kernel falhar
            return {
                content: this.generateFallbackResponse(state, detectedIntent),
                reasoning: {},
                nextSteps: state.missingParameters.map((p) => `Preciso saber: ${p}`),
                suggestedActions: context.suggestedActions || [],
            };
        }
    }
    /**
     * Gera resposta de fallback
     */
    generateFallbackResponse(state, intent) {
        if (state.missingParameters.length > 0) {
            const param = state.missingParameters[0];
            const questions = {
                workerId: 'Com qual profissional você gostaria de agendar?',
                date: 'Qual data você prefere?',
                time: 'Qual horário você prefere?',
                serviceId: 'Qual serviço você precisa?',
                productId: 'Qual produto você quer comprar?',
                quantity: 'Quantas unidades?',
                origin: 'De onde você quer partir?',
                destination: 'Para onde você quer ir?',
                eventId: 'Qual evento você quer participar?',
                restaurantId: 'De qual restaurante você quer pedir?',
                items: 'O que você quer pedir?',
            };
            return questions[param] || `Preciso saber: ${param}`;
        }
        if (intent) {
            return `Entendi! Vou processar sua solicitação de ${intent}.`;
        }
        return 'Como posso ajudar você hoje?';
    }
    /**
     * Busca sessão com mensagens
     */
    async getSession(tenantId, sessionId) {
        const sessionRow = await this.repository.findSessionById(tenantId, sessionId);
        if (!sessionRow) {
            return null;
        }
        const session = care_model_1.CareModel.fromRow(sessionRow);
        const { rows, total } = await this.repository.findMessagesBySession(tenantId, sessionId);
        return {
            ...session,
            messages: care_model_1.CareMessageModel.fromRows(rows),
            totalMessages: total,
        };
    }
    /**
     * Busca sessões de um usuário
     */
    async getSessionsByUser(tenantId, globalUserId) {
        const { rows } = await this.repository.findSessionsByUser(tenantId, globalUserId);
        return care_model_1.CareModel.fromRows(rows);
    }
}
exports.careService = new CareService();
//# sourceMappingURL=care.service.js.map