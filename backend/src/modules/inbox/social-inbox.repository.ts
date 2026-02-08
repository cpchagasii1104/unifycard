// src/modules/inbox/social-inbox.repository.ts
// Repository do Domínio de INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
// 🔴 BLINDAGEM: Nenhuma lógica de decisão ou ação automática aqui

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  SocialInboxItem,
  SocialInboxItemRow,
  SocialInboxFilters,
  InboxCounter,
} from './social-inbox.types';
import { InboxItemStatus, InboxSourceType } from './social-inbox.types';
import { BadRequestError, NotFoundError } from '@core/errors';

class SocialInboxRepository {
  /**
   * Converte SocialInboxItemRow para SocialInboxItem
   */
  private toSocialInboxItem(row: SocialInboxItemRow): SocialInboxItem {
    return {
      inboxItemId: row.inbox_item_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      readAt: row.readAt || undefined,
      archivedAt: row.archivedAt || undefined,
    };
  }

  /**
   * Cria ou atualiza um item do inbox
   * 🔴 BLINDAGEM: Inbox é READ MODEL, criado a partir de effects
   */
  async upsert(
    tenantId: string,
    actorId: string,
    sourceType: InboxSourceType,
    sourceId: string,
    metadata?: Record<string, any>
  ): Promise<SocialInboxItem> {
    if (!actorId) {
      throw new BadRequestError('actorId é obrigatório para criar item do inbox');
    }
    if (!sourceType) {
      throw new BadRequestError('sourceType é obrigatório para criar item do inbox');
    }
    if (!sourceId) {
      throw new BadRequestError('sourceId é obrigatório para criar item do inbox');
    }

    const row = await runQueryWithTenant<SocialInboxItemRow>(
      tenantId,
      `
      INSERT INTO social_inbox_items (
        tenant_id, actor_id, source_type, source_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (actor_id, source_type, source_id) 
      DO UPDATE SET 
        metadata = EXCLUDED.metadata,
        updatedAt = now()
      RETURNING *
      `,
      [
        tenantId,
        actorId,
        sourceType,
        sourceId,
        JSON.stringify(metadata || {}),
      ]
    );

    if (!row) {
      throw new BadRequestError('Failed to create or update inbox item');
    }

    return this.toSocialInboxItem(row);
  }

  /**
   * Busca item por ID
   */
  async findById(tenantId: string, inboxItemId: string): Promise<SocialInboxItem | null> {
    const row = await runQueryWithTenant<SocialInboxItemRow>(
      tenantId,
      `SELECT * FROM social_inbox_items WHERE inbox_item_id = $1 AND tenant_id = $2`,
      [inboxItemId, tenantId]
    );
    return row ? this.toSocialInboxItem(row) : null;
  }

  /**
   * Lista items do inbox com filtros
   * 🔴 BLINDAGEM: Ordenação apenas por createdAt DESC (mais recente primeiro)
   * 🔴 BLINDAGEM: NUNCA por score, NUNCA por importância
   */
  async find(tenantId: string, filters: SocialInboxFilters): Promise<SocialInboxItem[]> {
    if (!filters.actorId) {
      throw new BadRequestError('actorId é obrigatório para buscar items do inbox');
    }

    let query = `SELECT * FROM social_inbox_items WHERE tenant_id = $1 AND actor_id = $2`;
    const params: any[] = [tenantId, filters.actorId];
    let paramIndex = 3;

    if (filters.status !== undefined && filters.status !== null) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.sourceType) {
      query += ` AND source_type = $${paramIndex}`;
      params.push(filters.sourceType);
      paramIndex++;
    }

    // 🔴 BLINDAGEM: Ordenação apenas por createdAt DESC (mais recente primeiro)
    // NUNCA por score, NUNCA por importância
    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<SocialInboxItemRow>(tenantId, query, params);
    return rows.map(this.toSocialInboxItem);
  }

  /**
   * Atualiza status de um item do inbox
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   */
  async updateStatus(
    tenantId: string,
    inboxItemId: string,
    status: InboxItemStatus
  ): Promise<SocialInboxItem> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    updateFields.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;

    // Atualizar timestamps baseado no status
    if (status === InboxItemStatus.READ) {
      updateFields.push(`readAt = now()`);
    } else if (status === InboxItemStatus.ARCHIVED) {
      updateFields.push(`archivedAt = now()`);
    }

    params.push(inboxItemId, tenantId);
    paramIndex += 2;

    const row = await runQueryWithTenant<SocialInboxItemRow>(
      tenantId,
      `
      UPDATE social_inbox_items
      SET ${updateFields.join(', ')}, updatedAt = now()
      WHERE inbox_item_id = $${paramIndex - 1} AND tenant_id = $${paramIndex}
      RETURNING *
      `,
      params
    );

    if (!row) {
      throw new NotFoundError('Item do inbox não encontrado ou não foi possível atualizar');
    }

    return this.toSocialInboxItem(row);
  }

  /**
   * Calcula contador de inbox para um actor
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   */
  async getCounter(tenantId: string, actorId: string): Promise<InboxCounter> {
    const result = await runQueryWithTenant<{
      unread_count: number;
      read_count: number;
      archived_count: number;
      total_count: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
        COUNT(*) FILTER (WHERE status = 'read') as read_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        COUNT(*) as total_count
      FROM social_inbox_items
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );

    if (!result) {
      return {
        actorId,
        tenantId,
        unreadCount: 0,
        readCount: 0,
        archivedCount: 0,
        totalCount: 0,
        lastUpdated: new Date(),
      };
    }

    return {
      actorId,
      tenantId,
      unreadCount: parseInt(result.unread_count.toString()) || 0,
      readCount: parseInt(result.read_count.toString()) || 0,
      archivedCount: parseInt(result.archived_count.toString()) || 0,
      totalCount: parseInt(result.total_count.toString()) || 0,
      lastUpdated: new Date(),
    };
  }
}

export const socialInboxRepository = new SocialInboxRepository();



