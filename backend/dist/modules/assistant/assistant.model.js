"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantModel = void 0;
class AssistantModel {
    /**
     * Converte CareMessage para AssistantMessage
     */
    static fromCareMessage(message) {
        return {
            messageId: message.messageId,
            author: message.isFromUser ? 'user' : 'system',
            content: message.content,
            createdAt: message.createdAt,
            intent: message.intent || undefined,
            parameters: message.parameters || undefined,
        };
    }
    /**
     * Converte array de CareMessage para AssistantMessage[]
     */
    static fromCareMessages(messages) {
        return messages.map((msg) => this.fromCareMessage(msg));
    }
    /**
     * Converte SocialAction para AssistantSuggestedAction
     */
    static fromSocialAction(action) {
        // Mapear status
        let status = 'available';
        if (action.status === 'executed') {
            status = 'executed';
        }
        else if (action.status === 'failed') {
            status = 'failed';
        }
        else if (action.status === 'cancelled') {
            status = 'failed'; // Cancelled é tratado como failed
        }
        else {
            status = 'available';
        }
        // Gerar label baseado no intent
        const labels = {
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
    static fromSocialActions(actions) {
        return actions.map((action) => this.fromSocialAction(action));
    }
    /**
     * Monta AssistantConversation a partir de CareSession e mensagens
     */
    static buildConversation(session, messages, actions, channel = 'chat', targetType = 'global') {
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
exports.AssistantModel = AssistantModel;
