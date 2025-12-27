// src/modules/assistant/assistant.model.ts
import type {
  AssistantMessage,
  AssistantSuggestedAction,
  AssistantConversation,
  AssistantChannel,
  AssistantTargetType,
} from './assistant.types';
import type { CareMessage, CareSession } from '../care/care.types';
import type { SocialAction } from '../social-actions/social-actions.types';

export class AssistantModel {
  /**
   * Converte CareMessage para AssistantMessage
   */
  static fromCareMessage(message: CareMessage): AssistantMessage {
    return {
      messageId: message.messageId,
      author: message.isFromUser ? 'user' : 'system',
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      intent: message.intent || undefined,
      parameters: message.parameters || undefined,
    };
  }

  /**
   * Converte array de CareMessage para AssistantMessage[]
   */
  static fromCareMessages(messages: CareMessage[]): AssistantMessage[] {
    return messages.map((msg) => this.fromCareMessage(msg));
  }

  /**
   * Converte SocialAction para AssistantSuggestedAction
   */
  static fromSocialAction(action: SocialAction): AssistantSuggestedAction {
    // Mapear status
    let status: AssistantSuggestedAction['status'] = 'available';
    if (action.status === 'executed') {
      status = 'executed';
    } else if (action.status === 'failed') {
      status = 'failed';
    } else if (action.status === 'cancelled') {
      status = 'failed'; // Cancelled é tratado como failed
    } else {
      status = 'available';
    }

    // Gerar label baseado no intent
    const labels: Record<string, string> = {
      schedule_service: 'Agendar serviço',
      hire_service: 'Contratar serviço',
      buy_product: 'Comprar produto',
      request_ride: 'Chamar carro',
      book_event: 'Reservar evento',
      order_food: 'Pedir comida',
      delivery_pickup: 'Solicitar entrega',
      search_local: 'Buscar local',
      post_content: 'Publicar conteúdo',
      ask_question: 'Fazer pergunta',
      support: 'Suporte',
    };

    return {
      actionId: action.actionId,
      label: labels[action.intent] || `Executar ${action.intent}`,
      intent: action.intent,
      parameters: action.parameters,
      status,
    };
  }

  /**
   * Converte array de SocialAction para AssistantSuggestedAction[]
   */
  static fromSocialActions(actions: SocialAction[]): AssistantSuggestedAction[] {
    return actions.map((action) => this.fromSocialAction(action));
  }

  /**
   * Monta AssistantConversation a partir de CareSession e mensagens
   */
  static buildConversation(
    session: CareSession,
    messages: CareMessage[],
    actions: SocialAction[],
    channel: AssistantChannel = 'chat',
    targetType: AssistantTargetType = 'global'
  ): AssistantConversation {
    return {
      sessionId: session.careSessionId,
      channel,
      targetType,
      targetGlobalUserId: session.targetGlobalUserId,
      targetCompanyId: session.targetCompanyId,
      messages: this.fromCareMessages(messages),
      suggestedActions: this.fromSocialActions(actions),
    };
  }
}

