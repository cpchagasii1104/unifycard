"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialChatRepository = void 0;
// src/modules/social-chat/social-chat.repository.ts
const pool_1 = require("@core/database/pool");
class SocialChatRepository {
    /**
     * Busca mensagem por ID
     */
    async findById(tenantId, messageId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, createdAt
      FROM social_chat_messages
      WHERE message_id = $1
      LIMIT 1
      `, [messageId]);
        return row || null;
    }
    /**
     * Cria uma nova mensagem
     */
    async create(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
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
      RETURNING message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, createdAt
      `, [
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
        ]);
        if (!row) {
            throw new Error('Falha ao criar mensagem');
        }
        return row;
    }
    /**
     * Busca mensagens de uma conversa
     */
    async findByConversation(tenantId, conversationId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT message_id, conversation_id, tenant_id, global_user_id, content, raw_content, media, intent, confidence, categories, suggested_actions, metadata, createdAt
      FROM social_chat_messages
      WHERE conversation_id = $1
      ORDER BY createdAt ASC
      LIMIT $2 OFFSET $3
      `, [conversationId, limit, offset]);
        // Contar total
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as total
      FROM social_chat_messages
      WHERE conversation_id = $1
      `, [conversationId]);
        return {
            rows,
            totalCents: countRow ? Number(countRow.total) : 0,
        };
    }
}
exports.SocialChatRepository = SocialChatRepository;
