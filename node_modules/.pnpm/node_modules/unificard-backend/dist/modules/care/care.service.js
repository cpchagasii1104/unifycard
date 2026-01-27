"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.careService = void 0;
const care_repository_1 = require("./care.repository");
const care_model_1 = require("./care.model");
const social_chat_service_1 = require("../social-chat/social-chat.service");
const orchestrator_service_1 = require("@core/orchestrator/orchestrator.service");
// REMOVIDO: schedule.service foi removido (consolidado em Unified Availability)
// import { scheduleService } from '../schedule/schedule.service';
const social_actions_service_1 = require("../social-actions/social-actions.service");
const assistant_context_service_1 = require("@core/assistant-context/assistant-context.service");
const default_assumptions_service_1 = require("@core/assistant-context/default-assumptions.service");
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
        // REMOVIDO: schedule.service foi removido (consolidado em Unified Availability)
        // TODO: Migrar para unifiedAvailabilityService quando necessário
        if (detectedIntent === 'schedule_service' && parameters.workerId) {
            // Funcionalidade temporariamente desabilitada após remoção do schedule.service
            // updatedContext.scheduleAvailability será undefined até migração completa
        }
        // 7. Buscar contexto das interações do feed (para personalizar a resposta)
        let feedContext = null;
        try {
            feedContext = await assistant_context_service_1.assistantContextService.buildAssistantContext(tenantId, globalUserId);
        }
        catch (error) {
            // Silenciosamente ignora erros
            console.warn('Erro ao buscar contexto do feed:', error);
        }
        // 8. Gerar resposta do AI
        const aiResponse = await this.generateAIResponse(fastify, session, input.text, detectedIntent, updatedState, updatedContext, feedContext);
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
    async generateAIResponse(fastify, session, userMessage, detectedIntent, state, context, feedContext) {
        // Construir prompt com contexto do feed (se disponível)
        let contextSection = '';
        if (feedContext?.summary) {
            contextSection = `
Contexto do usuário (baseado em interações recentes):
${feedContext.summary}

Use esse contexto para:
- Personalizar a resposta de forma natural
- Evitar mencionar temas que o usuário evitou
- Sugerir coisas alinhadas aos interesses recentes
- Adaptar o tom ao momento atual do usuário
`;
        }
        // Construir lista de parâmetros faltantes (se houver)
        const missingParamsText = state.missingParameters.length > 0
            ? `Parâmetros que ainda não foram informados: ${state.missingParameters.join(', ')}`
            : 'Todos os parâmetros necessários já foram coletados.';
        // Gerar assunções padrão baseadas no contexto
        const assumptionsSummary = default_assumptions_service_1.defaultAssumptionsService.generateAssumptionsSummary({
            eventType: detectedIntent === 'create_event' ? 'social' : undefined,
            venueType: context.categories?.find((c) => c.includes('restaurant') || c.includes('bar')) ? 'restaurant' : undefined,
        });
        // Usar AI Kernel para gerar resposta
        const prompt = `
Você é um assistente experiente e confiante. Seu papel é AGIR, não perguntar o tempo todo.

REGRAS DE OURO:
1. Se você tem 80% de confiança, ASSUMA e execute. Não pergunte.
2. Use valores padrão sensatos quando possível (ex: 10-15 pessoas para eventos, hoje/amanhã para datas).
3. Fale como um humano experiente, não como um robô educado demais.
4. Uma mensagem = uma intenção. Não faça múltiplas perguntas juntas.
5. Se faltar algo crítico, pergunte UMA coisa por vez. Depois resolva e continue.

TOM:
- Use "Beleza", "Vou fazer", "Pronto" ao invés de "Posso prosseguir?"
- Diga "Só faltou uma coisa" ao invés de "Informações insufalientes"
- Seja direto: "Vou criar isso agora" ao invés de "Você gostaria que eu criasse?"

CONTEXTO:
- Mensagem do usuário: "${userMessage}"
- Intent detectada: ${detectedIntent || 'nenhuma'}
- ${missingParamsText}
- Histórico: ${context.conversationHistory.length} mensagens
${contextSection}${assumptionsSummary}

INSTRUÇÕES:
1. Se a intent está clara e você tem dados suficientes (ou pode assumir valores padrão), EXECUTE e informe o que fez.
2. USE AS ASSUNÇÕES PADRÃO quando não informado. Não pergunte por horário, público ou preço se houver assunção padrão.
3. Se faltar algo crítico que NÃO tem assunção padrão, pergunte APENAS UMA coisa de forma natural.
4. Use o contexto do usuário de forma sutil para personalizar (sem mencionar explicitamente).
5. Adapte o tom ao momento: explorar (curioso), aprender (focado), relaxar (leve), criar (direto).
6. Evite perguntas óbvias ou que o sistema já sabe (ex: ator, contexto da conversa).
7. Quando usar assunção padrão, confirme suavemente: "Vou considerar X, ok? Se quiser mudar, é só falar."

EXEMPLOS DE BOAS RESPOSTAS:
- "Beleza, vou criar um evento para hoje à noite. Se quiser mudar algo, é só falar."
- "Vou considerar umas 10-15 pessoas. Se quiser ajustar, me avisa."
- "Só falta saber o horário. Que horas você prefere?"

EXEMPLOS DE RESPOSTAS A EVITAR:
- "Você gostaria de criar um evento?" (assuma e faça)
- "Isso é pessoal ou profissional?" (já está no contexto)
- "Posso prosseguir com a criação?" (só faça)
- "Informações insuficientes" (seja humano)

Gere uma resposta seguindo essas regras:
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
                nextSteps: state.missingParameters.length > 0
                    ? [`Só falta saber: ${state.missingParameters[0]}`] // Apenas o primeiro, não todos
                    : [],
                suggestedActions: context.suggestedActions || [],
            };
        }
        catch (error) {
            // Fallback se AI Kernel falhar
            return {
                content: this.generateFallbackResponse(state, detectedIntent),
                reasoning: {},
                nextSteps: state.missingParameters.length > 0
                    ? [`Só falta saber: ${state.missingParameters[0]}`]
                    : [],
                suggestedActions: context.suggestedActions || [],
            };
        }
    }
    /**
     * Gera resposta de fallback (tom humano e confiante)
     */
    generateFallbackResponse(state, intent) {
        if (state.missingParameters.length > 0) {
            const param = state.missingParameters[0];
            const questions = {
                workerId: 'Só falta saber: com qual profissional você quer agendar?',
                date: 'Que dia você prefere?',
                time: 'Que horário funciona melhor?',
                serviceId: 'Qual serviço você precisa?',
                productId: 'Qual produto você quer?',
                quantity: 'Quantas unidades?',
                origin: 'De onde você quer partir?',
                destination: 'Para onde você quer ir?',
                eventId: 'Qual evento você quer participar?',
                restaurantId: 'De qual restaurante você quer pedir?',
                items: 'O que você quer pedir?',
            };
            return questions[param] || `Só falta saber: ${param}`;
        }
        if (intent) {
            // Respostas mais naturais por intent
            const intentResponses = {
                create_event: 'Beleza, vou criar o evento agora.',
                schedule_service: 'Vou agendar isso pra você.',
                hire_service: 'Vou organizar isso.',
                create_post: 'Pronto, vou publicar isso.',
            };
            return intentResponses[intent] || `Beleza, vou fazer isso agora.`;
        }
        return 'O que você quer fazer hoje?';
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
