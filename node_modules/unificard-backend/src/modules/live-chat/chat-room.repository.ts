// backend/src/modules/live-chat/chat-room.repository.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { runQueryWithTenant } from '@core/database/pool';
import type {
  ChatRoom,
  PresenceContextType,
  ChatRoomType,
} from './live-chat.types';

interface ChatRoomRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  room_type: string;
  status: string;
  metadata: any;
  created_at: Date;
}

class ChatRoomRepository {
  private toChatRoom(row: ChatRoomRow): ChatRoom {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      roomType: row.room_type as ChatRoomType,
      status: row.status as any,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async getOrCreateRoom(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    roomType: ChatRoomType = 'PUBLIC'
  ): Promise<ChatRoom> {
    // Tentar buscar existente
    const existing = await this.getRoom(tenantId, contextType, contextId, roomType);
    if (existing) {
      return existing;
    }

    // Criar novo
    const row = await runQueryWithTenant<ChatRoomRow>(
      tenantId,
      `
      INSERT INTO chat_rooms (
        tenant_id, context_type, context_id, room_type, status, metadata
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE', '{}'::jsonb)
      ON CONFLICT (tenant_id, context_type, context_id, room_type) DO UPDATE SET updated_at = NOW()
      RETURNING id, tenant_id, context_type, context_id, room_type, status, metadata, created_at
      `,
      [tenantId, contextType, contextId, roomType]
    );

    if (!row) {
      throw new Error('Erro ao criar sala de chat');
    }

    return this.toChatRoom(row);
  }

  async getRoom(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    roomType: ChatRoomType
  ): Promise<ChatRoom | null> {
    const row = await runQueryWithTenant<ChatRoomRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, room_type, status, metadata, created_at
      FROM chat_rooms
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND room_type = $4
        AND status = 'ACTIVE'
      `,
      [tenantId, contextType, contextId, roomType]
    );

    return row ? this.toChatRoom(row) : null;
  }

  async archiveRoom(tenantId: string, roomId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE chat_rooms
      SET status = 'ARCHIVED'
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, roomId]
    );
  }
}

export const chatRoomRepository = new ChatRoomRepository();





