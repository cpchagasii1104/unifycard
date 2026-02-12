// backend/src/modules/live-chat/chat-message.repository.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ChatMessage,
  ChatMessageStatus,
} from './live-chat.types';

interface ChatMessageRow {
  id: string;
  tenant_id: string;
  room_id: string;
  contact_id: string;
  content: string;
  status: string;
  client_message_id: string | null;
  metadata: any;
  createdAt: Date;
}

class ChatMessageRepository {
  private toChatMessage(row: ChatMessageRow): ChatMessage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      roomId: row.room_id,
      contactId: row.contact_id,
      content: row.content,
      status: row.status as ChatMessageStatus,
      clientMessageId: row.client_message_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createMessage(
    tenantId: string,
    roomId: string,
    contactId: string,
    content: string,
    clientMessageId: string | null
  ): Promise<ChatMessage> {
    // Tentar inserir (idempotente)
    const row = await runQueryWithTenant<ChatMessageRow>(
      tenantId,
      `
      INSERT INTO chat_messages (
        tenant_id, room_id, contact_id, content, status, client_message_id, metadata
      )
      VALUES ($1, $2, $3, $4, 'VISIBLE', $5, '{}'::jsonb)
      ON CONFLICT (tenant_id, room_id, contact_id, client_message_id) DO NOTHING
      RETURNING id, tenant_id, room_id, contact_id, content, status, client_message_id, metadata, createdAt
      `,
      [tenantId, roomId, contactId, content, clientMessageId]
    );

    // Se já existe (idempotência), buscar existente
    if (!row && clientMessageId) {
      const existing = await runQueryWithTenant<ChatMessageRow>(
        tenantId,
        `
        SELECT id, tenant_id, room_id, contact_id, content, status, client_message_id, metadata, createdAt
        FROM chat_messages
        WHERE tenant_id = $1 AND room_id = $2 AND contact_id = $3 AND client_message_id = $4
        `,
        [tenantId, roomId, contactId, clientMessageId]
      );

      if (existing) {
        return this.toChatMessage(existing);
      }
    }

    if (!row) {
      throw new Error('Erro ao criar mensagem');
    }

    return this.toChatMessage(row);
  }

  async listMessages(
    tenantId: string,
    roomId: string,
    cursor: string | null,
    limit: number = 50,
    blockedContactIds: string[] = []
  ): Promise<ChatMessage[]> {
    const conditions: string[] = ['tenant_id = $1', 'room_id = $2', 'status = $3'];
    const params: any[] = [tenantId, roomId, 'VISIBLE'];
    let paramIndex = 4;

    // Filtrar mensagens de contatos bloqueados
    if (blockedContactIds.length > 0) {
      conditions.push(`contact_id != ALL($${paramIndex}::UUID[])`);
      params.push(blockedContactIds);
      paramIndex++;
    }

    // Cursor (pagination)
    if (cursor) {
      conditions.push(`createdAt < $${paramIndex}`);
      params.push(new Date(cursor));
      paramIndex++;
    }

    const rows = await runQueriesWithTenant<ChatMessageRow>(
      tenantId,
      `
      SELECT id, tenant_id, room_id, contact_id, content, status, client_message_id, metadata, createdAt
      FROM chat_messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex}
      `,
      [...params, limit]
    );

    return rows.map((row) => this.toChatMessage(row));
  }

  async deleteMessage(tenantId: string, messageId: string, contactId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE chat_messages
      SET status = 'DELETED'
      WHERE tenant_id = $1 AND id = $2 AND contact_id = $3
      `,
      [tenantId, messageId, contactId]
    );
  }

  async countMessagesInWindow(
    tenantId: string,
    contactId: string,
    windowMinutes: number
  ): Promise<number> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::TEXT as count
      FROM chat_messages
      WHERE tenant_id = $1 AND contact_id = $2 AND createdAt >= $3
      `,
      [tenantId, contactId, windowStart]
    );

    return row ? parseInt(row.count, 10) : 0;
  }
}

export const chatMessageRepository = new ChatMessageRepository();







