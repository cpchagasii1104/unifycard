// backend/src/modules/marketplace/marketplace-plugin.repository.ts
// FASE X — Bloco 3: Plugin Engine (persistência)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface MarketplacePluginRow {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  status: string;
  config: Record<string, unknown> | null;
  created_at: Date;
}

export interface MarketplacePluginExecutionRow {
  id: string;
  tenant_id: string;
  plugin_id: string;
  hook: string;
  payload: Record<string, unknown> | null;
  status: string;
  executed_at: Date;
}

export interface CreatePluginInput {
  name: string;
  category: string;
  status: string;
  config?: Record<string, unknown> | null;
}

export interface RecordExecutionInput {
  pluginId: string;
  hook: string;
  payload?: Record<string, unknown> | null;
  status: string;
}

class MarketplacePluginRepository {
  async createPlugin(tenantId: string, input: CreatePluginInput): Promise<MarketplacePluginRow> {
    const row = await runQueryWithTenant<MarketplacePluginRow>(
      tenantId,
      `
      INSERT INTO marketplace_plugins (tenant_id, name, category, status, config)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, name, category, status, config, created_at
      `,
      [tenantId, input.name, input.category, input.status, input.config ?? null]
    );
    if (!row) throw new Error('Plugin not created');
    return row;
  }

  async getByCategory(
    tenantId: string,
    category: string,
    status?: string | null
  ): Promise<MarketplacePluginRow[]> {
    if (status) {
      return runQueriesWithTenant<MarketplacePluginRow>(
        tenantId,
        `SELECT id, tenant_id, name, category, status, config, created_at
         FROM marketplace_plugins WHERE tenant_id = $1 AND category = $2 AND status = $3`,
        [tenantId, category, status]
      );
    }
    return runQueriesWithTenant<MarketplacePluginRow>(
      tenantId,
      `SELECT id, tenant_id, name, category, status, config, created_at
       FROM marketplace_plugins WHERE tenant_id = $1 AND category = $2`,
      [tenantId, category]
    );
  }

  async getActive(tenantId: string): Promise<MarketplacePluginRow[]> {
    return runQueriesWithTenant<MarketplacePluginRow>(
      tenantId,
      `SELECT id, tenant_id, name, category, status, config, created_at
       FROM marketplace_plugins WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );
  }

  async getById(tenantId: string, pluginId: string): Promise<MarketplacePluginRow | null> {
    const row = await runQueryWithTenant<MarketplacePluginRow>(
      tenantId,
      `SELECT id, tenant_id, name, category, status, config, created_at
       FROM marketplace_plugins WHERE tenant_id = $1 AND id = $2`,
      [tenantId, pluginId]
    );
    return row ?? null;
  }

  async updateStatus(
    tenantId: string,
    pluginId: string,
    status: string
  ): Promise<MarketplacePluginRow> {
    const row = await runQueryWithTenant<MarketplacePluginRow>(
      tenantId,
      `UPDATE marketplace_plugins SET status = $3 WHERE tenant_id = $1 AND id = $2
       RETURNING id, tenant_id, name, category, status, config, created_at`,
      [tenantId, pluginId, status]
    );
    if (!row) throw new Error('Plugin not found');
    return row;
  }

  async recordExecution(tenantId: string, input: RecordExecutionInput): Promise<MarketplacePluginExecutionRow> {
    const row = await runQueryWithTenant<MarketplacePluginExecutionRow>(
      tenantId,
      `INSERT INTO marketplace_plugin_executions (tenant_id, plugin_id, hook, payload, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, plugin_id, hook, payload, status, executed_at`,
      [tenantId, input.pluginId, input.hook, input.payload ?? null, input.status]
    );
    if (!row) throw new Error('Execution not recorded');
    return row;
  }

  async listExecutions(
    tenantId: string,
    pluginId: string,
    hook?: string | null
  ): Promise<MarketplacePluginExecutionRow[]> {
    if (hook) {
      return runQueriesWithTenant<MarketplacePluginExecutionRow>(
        tenantId,
        `SELECT id, tenant_id, plugin_id, hook, payload, status, executed_at
         FROM marketplace_plugin_executions WHERE tenant_id = $1 AND plugin_id = $2 AND hook = $3
         ORDER BY executed_at DESC`,
        [tenantId, pluginId, hook]
      );
    }
    return runQueriesWithTenant<MarketplacePluginExecutionRow>(
      tenantId,
      `SELECT id, tenant_id, plugin_id, hook, payload, status, executed_at
       FROM marketplace_plugin_executions WHERE tenant_id = $1 AND plugin_id = $2
       ORDER BY executed_at DESC`,
      [tenantId, pluginId]
    );
  }
}

export const marketplacePluginRepository = new MarketplacePluginRepository();