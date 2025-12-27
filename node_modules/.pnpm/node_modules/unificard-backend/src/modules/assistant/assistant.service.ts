// src/modules/assistant/assistant.service.ts
import type { FastifyInstance } from 'fastify';
import { careService } from '../care/care.service';
import { socialActionsService } from '../social-actions/social-actions.service';
import { memoryService } from '@core/memory/memory.service';
import { AssistantModel } from './assistant.model';
import type {
  SendAssistantMessageInput,
  AssistantResponse,
  AssistantConversation,
  AssistantChannel,
  AssistantTargetType,
  AssistantSuggestedAction,
  UserContext,
} from './assistant.types';

class AssistantService {
  /**
   * Determina o targetType baseado nos parâmetros
   */
  private determineTargetType(
    targetGlobalUserId?: string,
    targetCompanyId?: string
  ): AssistantTargetType {
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
  async sendMessage(
    fastify: FastifyInstance,
    userContext: UserContext,
    input: SendAssistantMessageInput
  ): Promise<AssistantResponse> {
    // 1. Normalizar channel (default 'chat')
    const channel: AssistantChannel = input.channel || 'chat';

    // 2. Determinar targetType
    const targetType = this.determineTargetType(
      input.targetGlobalUserId,
      input.targetCompanyId
    );

    // 3. Chamar CARE para processar mensagem
    const careResponse = await careService.processUserMessage(
      fastify,
      userContext.tenantId,
      userContext.globalUserId,
      {
        text: input.text,
        targetGlobalUserId: input.targetGlobalUserId || null,
        targetCompanyId: input.targetCompanyId || null,
        sessionId: input.sessionId || null,
      }
    );

    // 4. Buscar mensagens da sessão
    const sessionWithMessages = await careService.getSession(
      userContext.tenantId,
      careResponse.session.careSessionId
    );

    if (!sessionWithMessages) {
      throw new Error('Sessão não encontrada após processamento');
    }

    // 5. Buscar ações sociais vinculadas à sessão
    let actions: any[] = [];
    try {
      // Buscar ações criadas a partir desta sessão (usando sessionId como postId)
      const sessionActions = await socialActionsService.getActionsByPost(
        userContext.tenantId,
        careResponse.session.careSessionId
      );
      actions = sessionActions;
    } catch (error) {
      // Silenciosamente ignora erros ao buscar ações
      console.warn('Erro ao buscar ações sociais:', error);
    }

    // 6. Buscar contexto de memória do usuário
    let memoryContext: any = undefined;
    try {
      const memoryUserContext = await memoryService.getUserContext(
        userContext.tenantId,
        userContext.globalUserId
      );
      memoryContext = {
        preferences: memoryUserContext.preferences,
        frequentEntities: memoryUserContext.frequentEntities.slice(0, 5), // Top 5
        suggestedShortcuts: memoryUserContext.suggestedShortcuts.slice(0, 5), // Top 5
      };
    } catch (error) {
      // Silenciosamente ignora erros ao buscar memória
      console.warn('Erro ao buscar contexto de memória:', error);
    }

    // 7. Montar AssistantConversation
    const conversation: AssistantConversation = AssistantModel.buildConversation(
      careResponse.session,
      sessionWithMessages.messages,
      actions,
      channel,
      targetType
    );
    conversation.memoryContext = memoryContext;

    // 8. Montar lastMessage
    const lastMessage = AssistantModel.fromCareMessage(careResponse.message);

    // 9. Atualizar memória se houver execução
    if (careResponse.executionResult && careResponse.executionResult.success) {
      try {
        await memoryService.updateFromIntent(
          userContext.tenantId,
          userContext.globalUserId,
          {
            intent: careResponse.session.context.detectedIntents[0]?.intent || '',
            parameters: careResponse.session.context.detectedIntents[0]?.parameters || {},
            entityType: input.targetGlobalUserId ? 'worker' : input.targetCompanyId ? 'company' : undefined,
            entityId: input.targetGlobalUserId || input.targetCompanyId || undefined,
          }
        );
      } catch (error) {
        // Silenciosamente ignora erros ao atualizar memória
        console.warn('Erro ao atualizar memória:', error);
      }
    }

    // 10. Montar executedActions se houver execução
    let executedActions: AssistantSuggestedAction[] | undefined = undefined;
    if (careResponse.executionResult) {
      // Se houve execução, buscar a ação executada
      try {
        const executedAction = await socialActionsService.getAction(
          userContext.tenantId,
          careResponse.executionResult.actionId || ''
        );
        if (executedAction) {
          executedActions = [AssistantModel.fromSocialAction(executedAction)];
        }
      } catch (error) {
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
  async getConversation(
    fastify: FastifyInstance,
    userContext: UserContext,
    sessionId: string,
    channel: AssistantChannel = 'chat'
  ): Promise<AssistantConversation> {
    // 1. Buscar sessão com mensagens via CARE
    const sessionWithMessages = await careService.getSession(
      userContext.tenantId,
      sessionId
    );

    if (!sessionWithMessages) {
      throw new Error('Sessão não encontrada');
    }

    // 2. Determinar targetType
    const targetType = this.determineTargetType(
      sessionWithMessages.targetGlobalUserId || undefined,
      sessionWithMessages.targetCompanyId || undefined
    );

    // 3. Buscar ações sociais vinculadas
    let actions: any[] = [];
    try {
      const sessionActions = await socialActionsService.getActionsByPost(
        userContext.tenantId,
        sessionId
      );
      actions = sessionActions;
    } catch (error) {
      // Silenciosamente ignora erros
      console.warn('Erro ao buscar ações sociais:', error);
    }

    // 4. Buscar contexto de memória do usuário
    let memoryContext: any = undefined;
    try {
      const memoryUserContext = await memoryService.getUserContext(
        userContext.tenantId,
        userContext.globalUserId
      );
      memoryContext = {
        preferences: memoryUserContext.preferences,
        frequentEntities: memoryUserContext.frequentEntities.slice(0, 5),
        suggestedShortcuts: memoryUserContext.suggestedShortcuts.slice(0, 5),
      };
    } catch (error) {
      // Silenciosamente ignora erros
      console.warn('Erro ao buscar contexto de memória:', error);
    }

    // 5. Montar AssistantConversation
    const conversation: AssistantConversation = AssistantModel.buildConversation(
      sessionWithMessages,
      sessionWithMessages.messages,
      actions,
      channel,
      targetType
    );
    conversation.memoryContext = memoryContext;

    return conversation;
  }
}

export const assistantService = new AssistantService();

