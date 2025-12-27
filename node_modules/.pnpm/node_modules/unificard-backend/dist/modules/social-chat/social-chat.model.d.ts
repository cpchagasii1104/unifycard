import type { ChatMessage, ChatMessageRow } from './social-chat.types';
export declare class SocialChatModel {
    static fromRow(row: ChatMessageRow): ChatMessage;
    static fromRows(rows: ChatMessageRow[]): ChatMessage[];
    static toRow(message: Partial<ChatMessage>): Partial<ChatMessageRow>;
}
//# sourceMappingURL=social-chat.model.d.ts.map