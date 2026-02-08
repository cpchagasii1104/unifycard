// src/modules/social-chat/social-chat.model.ts
import type { ChatMessage, ChatMessageRow } from './social-chat.types';

export class SocialChatModel {
  static fromRow(row: ChatMessageRow): ChatMessage {
    return {
      messageId: row.message_id,
      conversationId: row.conversation_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      content: row.content,
      rawContent: row.raw_content ?? undefined,
      media: Array.isArray(row.media) ? row.media : [],
      intent: row.intent ?? undefined,
      confidence: row.confidence ?? undefined,
      categories: Array.isArray(row.categories) ? row.categories : [],
      suggestedActions: Array.isArray(row.suggested_actions) ? row.suggested_actions : [],
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      createdAt: row.createdAt,
    };
  }

  static fromRows(rows: ChatMessageRow[]): ChatMessage[] {
    return rows.map((row) => this.fromRow(row));
  }

  static toRow(message: Partial<ChatMessage>): Partial<ChatMessageRow> {
    const row: Partial<ChatMessageRow> = {};

    if (message.messageId !== undefined) row.message_id = message.messageId;
    if (message.conversationId !== undefined) row.conversation_id = message.conversationId;
    if (message.tenantId !== undefined) row.tenant_id = message.tenantId;
    if (message.globalUserId !== undefined) row.global_user_id = message.globalUserId;
    if (message.content !== undefined) row.content = message.content;
    if (message.rawContent !== undefined) row.raw_content = message.rawContent ?? null;
    if (message.media !== undefined) row.media = message.media;
    if (message.intent !== undefined) row.intent = message.intent ?? null;
    if (message.confidence !== undefined) row.confidence = message.confidence ?? null;
    if (message.categories !== undefined) row.categories = message.categories;
    if (message.suggestedActions !== undefined) row.suggested_actions = message.suggestedActions;
    if (message.metadata !== undefined) row.metadata = message.metadata;

    return row;
  }
}


















