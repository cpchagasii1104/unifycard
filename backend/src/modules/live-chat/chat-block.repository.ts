// backend/src/modules/live-chat/chat-block.repository.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ChatBlock,
  PresenceContextType,
} from './live-chat.types';

interface ChatBlockRow {
  id: string;
  tenant_id: string;
  blocker_contact_id: string;
  blocked_contact_id: string;
  context_type: string;
  context_id: string;
  metadata: any;
  createdAt: Date;
}

class ChatBlockRepository {
  private toChatBlock(row: ChatBlockRow): ChatBlock {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      blockerContactId: row.blocker_contact_id,
      blockedContactId: row.blocked_contact_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createBlock(
    tenantId: string,
    blockerContactId: string,
    blockedContactId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<ChatBlock> {
    const row = await runQueryWithTenant<ChatBlockRow>(
      tenantId,
      `
      INSERT INTO chat_blocks (
        tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)
      ON CONFLICT (tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id) DO NOTHING
      RETURNING id, tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id, metadata, createdAt
      `,
      [tenantId, blockerContactId, blockedContactId, contextType, contextId]
    );

    // Se já existe (idempotência), buscar existente
    if (!row) {
      const existing = await runQueryWithTenant<ChatBlockRow>(
        tenantId,
        `
        SELECT id, tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id, metadata, createdAt
        FROM chat_blocks
        WHERE tenant_id = $1 AND blocker_contact_id = $2 AND blocked_contact_id = $3 AND context_type = $4 AND context_id = $5
        `,
        [tenantId, blockerContactId, blockedContactId, contextType, contextId]
      );

      if (existing) {
        return this.toChatBlock(existing);
      }
    }

    if (!row) {
      throw new Error('Erro ao criar bloqueio');
    }

    return this.toChatBlock(row);
  }

  async listBlockedContacts(
    tenantId: string,
    blockerContactId: string
  ): Promise<string[]> {
    const rows = await runQueriesWithTenant<ChatBlockRow>(
      tenantId,
      `
      SELECT blocked_contact_id
      FROM chat_blocks
      WHERE tenant_id = $1 AND blocker_contact_id = $2
      `,
      [tenantId, blockerContactId]
    );

    return rows.map((row) => row.blocked_contact_id);
  }

  async isBlocked(
    tenantId: string,
    blockerContactId: string,
    blockedContactId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<boolean> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::TEXT as count
      FROM chat_blocks
      WHERE tenant_id = $1 AND blocker_contact_id = $2 AND blocked_contact_id = $3
        AND context_type = $4 AND context_id = $5
      `,
      [tenantId, blockerContactId, blockedContactId, contextType, contextId]
    );

    return row ? parseInt(row.count, 10) > 0 : false;
  }
}

export const chatBlockRepository = new ChatBlockRepository();







