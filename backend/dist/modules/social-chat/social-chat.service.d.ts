import type { FastifyInstance } from 'fastify';
import type { ChatMessage, SendMessageInput, Conversation } from './social-chat.types';
declare class SocialChatService {
    private repository;
    /**
     * Transcreve áudio (placeholder para futuro)
     */
    private transcribeAudio;
    /**
     * Envia uma mensagem e processa automaticamente
     */
    sendMessage(fastify: FastifyInstance, tenantId: string, globalUserId: string, input: SendMessageInput): Promise<ChatMessage>;
    /**
     * Busca mensagem por ID
     */
    getMessage(tenantId: string, messageId: string): Promise<ChatMessage | null>;
    /**
     * Busca conversa completa com mensagens e ações
     */
    getConversation(tenantId: string, conversationId: string): Promise<Conversation>;
}
export declare const socialChatService: SocialChatService;
export {};
//# sourceMappingURL=social-chat.service.d.ts.map