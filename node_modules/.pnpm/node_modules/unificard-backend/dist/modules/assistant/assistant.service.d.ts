import type { FastifyInstance } from 'fastify';
import type { SendAssistantMessageInput, AssistantResponse, AssistantConversation, AssistantChannel, UserContext } from './assistant.types';
declare class AssistantService {
    /**
     * Determina o targetType baseado nos parâmetros
     */
    private determineTargetType;
    /**
     * Envia mensagem e processa via CARE
     */
    sendMessage(fastify: FastifyInstance, userContext: UserContext, input: SendAssistantMessageInput): Promise<AssistantResponse>;
    /**
     * Busca conversa por sessionId
     */
    getConversation(fastify: FastifyInstance, userContext: UserContext, sessionId: string, channel?: AssistantChannel): Promise<AssistantConversation>;
}
export declare const assistantService: AssistantService;
export {};
//# sourceMappingURL=assistant.service.d.ts.map