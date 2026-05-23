// backend/src/modules/venue/tab.repository.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { randomBytes } from 'crypto';
import type {
  Tab,
  OpenTabInput,
  TabFilters,
  TabStatus,
} from './tab.types';

interface TabRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  opened_by_contact_id: string | null;
  opened_by_user_id: string | null;
  status: string;
  table_label: string | null;
  qr_token: string;
  opened_at: Date;
  closed_at: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface TabOrderRow {
  id: string;
  tenant_id: string;
  tab_id: string;
  order_id: string;
  created_at: Date;
}

class TabRepository {
  private toTab(row: TabRow): Tab {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      openedByContactId: row.opened_by_contact_id,
      openedByUserId: row.opened_by_user_id,
      status: row.status as TabStatus,
      tableLabel: row.table_label,
      qrToken: row.qr_token,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Gera token QR único e não adivinhável
   */
  private generateQrToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createTab(tenantId: string, input: OpenTabInput, contactId?: string, userId?: string): Promise<Tab> {
    let qrToken = this.generateQrToken();
    let attempts = 0;
    
    // Garantir token único
    while (attempts < 10) {
      const existing = await this.getTabByToken(tenantId, qrToken);
      if (!existing) {
        break;
      }
      qrToken = this.generateQrToken();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('Erro ao gerar token QR único');
    }

    const row = await runQueryWithTenant<TabRow>(
      tenantId,
      `
      INSERT INTO tabs (
        tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
        status, table_label, qr_token, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
                status, table_label, qr_token, opened_at, closed_at,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.actorId,
        contactId || null,
        userId || null,
        'OPEN',
        input.tableLabel || null,
        qrToken,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar comanda');
    }

    return this.toTab(row);
  }

  async getTabById(tenantId: string, tabId: string): Promise<Tab | null> {
    const row = await runQueryWithTenant<TabRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
             status, table_label, qr_token, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM tabs
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, tabId]
    );

    return row ? this.toTab(row) : null;
  }

  async getTabByToken(tenantId: string, qrToken: string): Promise<Tab | null> {
    const row = await runQueryWithTenant<TabRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
             status, table_label, qr_token, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM tabs
      WHERE tenant_id = $1 AND qr_token = $2
      `,
      [tenantId, qrToken]
    );

    return row ? this.toTab(row) : null;
  }

  async listTabs(tenantId: string, filters: TabFilters = {}): Promise<Tab[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<TabRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
             status, table_label, qr_token, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM tabs
      WHERE ${conditions.join(' AND ')}
      ORDER BY opened_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toTab(row));
  }

  async closeTab(tenantId: string, tabId: string, summary?: Record<string, any>): Promise<Tab> {
    const row = await runQueryWithTenant<TabRow>(
      tenantId,
      `
      UPDATE tabs
      SET status = 'CLOSED',
          closed_at = NOW(),
          updated_at = NOW(),
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{summary}', $1::jsonb)
      WHERE tenant_id = $2 AND id = $3 AND status = 'OPEN'
      RETURNING id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id,
                status, table_label, qr_token, opened_at, closed_at,
                metadata, created_at, updated_at
      `,
      [JSON.stringify(summary || {}), tenantId, tabId]
    );

    if (!row) {
      throw new Error('Comanda não encontrada ou já fechada');
    }

    return this.toTab(row);
  }

  async attachOrderToTab(tenantId: string, tabId: string, orderId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO tab_orders (tenant_id, tab_id, order_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, tab_id, order_id) DO NOTHING
      `,
      [tenantId, tabId, orderId]
    );
  }

  async getTabOrders(tenantId: string, tabId: string): Promise<Array<{ id: string; orderId: string; createdAt: Date }>> {
    const rows = await runQueriesWithTenant<TabOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, tab_id, order_id, created_at
      FROM tab_orders
      WHERE tenant_id = $1 AND tab_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, tabId]
    );

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }
}

export const tabRepository = new TabRepository();
