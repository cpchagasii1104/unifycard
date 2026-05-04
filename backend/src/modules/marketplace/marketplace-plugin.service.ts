// backend/src/modules/marketplace/marketplace-plugin.service.ts
// FASE X — Bloco 3: Plugin Engine (registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook)

import type { PluginDefinition, PluginExecution, PluginCategory, PluginHook } from '@contracts/marketplace/PluginDefinition.contract';
import type { MarketplacePluginRow, MarketplacePluginExecutionRow } from './marketplace-plugin.repository';
import { marketplacePluginRepository } from './marketplace-plugin.repository';

function rowToPluginDefinition(row: MarketplacePluginRow): PluginDefinition {
  const config = (row.config as Record<string, unknown>) ?? {};
  return {
    pluginId: row.id,
    name: row.name,
    description: (config.description as string) ?? '',
    category: row.category as PluginCategory,
    version: (config.version as string) ?? '1.0.0',
    allowedHooks: (config.allowedHooks as PluginHook[]) ?? [],
    allowedContracts: (config.allowedContracts as string[]) ?? [],
    status: row.status as 'active' | 'inactive' | 'deprecated',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    metadata: config.metadata as Record<string, any> | undefined,
  };
}

function rowToPluginExecution(row: MarketplacePluginExecutionRow): PluginExecution {
  return {
    executionId: row.id,
    pluginId: row.plugin_id,
    hook: row.hook as PluginHook,
    inputData: (row.payload as Record<string, any>) ?? {},
    status: row.status as 'pending' | 'executed' | 'failed',
    executedAt: row.executed_at instanceof Date ? row.executed_at.toISOString() : String(row.executed_at),
  };
}

export interface RegisterPluginInput {
  name: string;
  description?: string;
  category: PluginCategory;
  version?: string;
  allowedHooks?: PluginHook[];
  allowedContracts?: string[];
  status?: 'active' | 'inactive' | 'deprecated';
  metadata?: Record<string, any>;
}

class MarketplacePluginService {
  async registerPlugin(tenantId: string, input: RegisterPluginInput): Promise<PluginDefinition> {
    const config: Record<string, unknown> = {
      description: input.description ?? '',
      version: input.version ?? '1.0.0',
      allowedHooks: input.allowedHooks ?? [],
      allowedContracts: input.allowedContracts ?? [],
      metadata: input.metadata,
    };
    const row = await marketplacePluginRepository.createPlugin(tenantId, {
      name: input.name,
      category: input.category,
      status: input.status ?? 'active',
      config,
    });
    return rowToPluginDefinition(row);
  }

  async getPluginsByCategory(
    tenantId: string,
    category: PluginCategory,
    status?: 'active' | 'inactive' | 'deprecated' | null
  ): Promise<PluginDefinition[]> {
    const rows = await marketplacePluginRepository.getByCategory(tenantId, category, status ?? undefined);
    return rows.map(rowToPluginDefinition);
  }

  async getActivePlugins(tenantId: string): Promise<PluginDefinition[]> {
    const rows = await marketplacePluginRepository.getActive(tenantId);
    return rows.map(rowToPluginDefinition);
  }

  async getPlugin(tenantId: string, pluginId: string): Promise<PluginDefinition | null> {
    const row = await marketplacePluginRepository.getById(tenantId, pluginId);
    if (!row) return null;
    return rowToPluginDefinition(row);
  }

  async updatePluginStatus(
    tenantId: string,
    pluginId: string,
    status: 'active' | 'inactive' | 'deprecated'
  ): Promise<PluginDefinition> {
    const row = await marketplacePluginRepository.updateStatus(tenantId, pluginId, status);
    return rowToPluginDefinition(row);
  }

  async getPluginExecutions(
    tenantId: string,
    pluginId: string,
    hook?: PluginHook | null
  ): Promise<PluginExecution[]> {
    const rows = await marketplacePluginRepository.listExecutions(tenantId, pluginId, hook ?? undefined);
    return rows.map(rowToPluginExecution);
  }

  async executePluginHook(
    tenantId: string,
    hook: PluginHook,
    input_data: Record<string, any>,
    context?: { company_id?: string; store_id?: string; actor_id?: string }
  ): Promise<{ executionId: string; pluginId: string }[]> {
    const activePlugins = await marketplacePluginRepository.getActive(tenantId);
    const results: { executionId: string; pluginId: string }[] = [];
    for (const plugin of activePlugins) {
      const config = (plugin.config as Record<string, unknown>) ?? {};
      const allowedHooks = (config.allowedHooks as string[]) ?? [];
      if (!allowedHooks.includes(hook)) continue;
      const payload = { ...input_data, context };
      const exec = await marketplacePluginRepository.recordExecution(tenantId, {
        pluginId: plugin.id,
        hook,
        payload,
        status: 'executed',
      });
      results.push({ executionId: exec.id, pluginId: plugin.id });
    }
    return results;
  }
}

export const marketplacePluginService = new MarketplacePluginService();