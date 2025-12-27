import type { ChatMessageRow } from './social-chat.types';
export declare class SocialChatRepository {
    /**
     * Busca mensagem por ID
     */
    findById(tenantId: string, messageId: string): Promise<ChatMessageRow | null>;
    /**
     * Cria uma nova mensagem
     */
    create(data: {
        conversationId: string;
        tenantId: string;
        globalUserId: string;
        content: string;
        rawContent?: string | null;
        media: any;
        intent: string | null;
        confidence: number | null;
        categories: string[];
        suggestedActions: any;
        metadata: any;
    }): Promise<ChatMessageRow>;
    /**
     * Busca mensagens de uma conversa
     */
    findByConversation(tenantId: string, conversationId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        rows: ChatMessageRow[];
        total: number;
    }>;
}
//# sourceMappingURL=social-chat.repository.d.ts.map