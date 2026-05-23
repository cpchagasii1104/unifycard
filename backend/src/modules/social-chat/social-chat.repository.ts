// src/modules/social-chat/social-chat.repository.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ChatMessageRow } from './social-chat.types';

export class SocialChatRepository {
  /**
   * Busca mensagem por ID
   */
  async findById(tenantId: string, messageId: string): Promise<ChatMessageRow | null> {
    const row = await runQueryWithTenant<ChatMessageRow>(
      tenantId,
      `
      SELECT message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, created_at
      FROM social_chat_messages
      WHERE message_id = $1
      LIMIT 1
      `,
      [messageId]
    );

    return row || null;
  }

  /**
   * Cria uma nova mensagem
   */
  async create(data: {
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
  }): Promise<ChatMessageRow> {
    const row = await runQueryWithTenant<ChatMessageRow>(
      data.tenantId,
      `
      INSERT INTO social_chat_messages (
        conversation_id,
        tenant_id,
        global_user_id,
        content,
        raw_content,
        media,
        intent,
        confidence,
        categories,
        suggested_actions,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, created_at
      `,
      [
        data.conversationId,
        data.tenantId,
        data.globalUserId,
        data.content,
        data.rawContent ?? null,
        JSON.stringify(data.media),
        data.intent,
        data.confidence,
        data.categories,
        JSON.stringify(data.suggestedActions),
        JSON.stringify(data.metadata),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar mensagem');
    }

    return row;
  }

  /**
   * Busca mensagens de uma conversa
   */
  async findByConversation(
    tenantId: string,
    conversationId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ rows: ChatMessageRow[]; totalCents: number }> {
    const { limit = 100, offset = 0 } = options;

    const rows = await runQueriesWithTenant<ChatMessageRow>(tenantId, {
      text: `
      SELECT message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, created_at
      FROM social_chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
      `,
      values: [conversationId, limit, offset],
    });

    // Contar total
    const countRow = await runQueryWithTenant<{ totalCents: string }>(tenantId, {
      text: `
      SELECT COUNT(*)::text as "totalCents"
      FROM social_chat_messages
      WHERE conversation_id = $1
      `,
      values: [conversationId],
    });

    return {
      rows,
      totalCents: countRow ? Number(countRow.totalCents) : 0,
    };
  }
}


















