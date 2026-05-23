// src/core/config/config.service.ts

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import {
  ConfigValue,
  ConfigValueType,
  TenantConfig,
  TenantConfigRow,
  FeatureFlag,
  FeatureFlagRow,
  ConfigSetOptions,
  FeatureFlagUpsertInput,
} from './config.types';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '@core/events/event-outbox.repository';
import * as crypto from 'crypto';

function inferValueType(valueCents: ConfigValue): ConfigValueType {
  if (typeof valueCents === 'string') return 'string';
  if (typeof valueCents === 'number') return 'number';
  if (typeof valueCents === 'boolean') return 'boolean';
  return 'json';
}

function mapConfigRow(row: TenantConfigRow): TenantConfig {
  let valueCents = row.value as ConfigValue;

  if (row.value_type === 'json' && typeof row.value === 'string') {
    try {
      valueCents = JSON.parse(row.value as string);
    } catch {
      valueCents = row.value as ConfigValue;
    }
  }

  const created = row.created_at;
  const updated = row.updated_at;
  return {
    configId: row.config_id,
    tenantId: row.tenant_id,
    module: row.module,
    key: row.key,
    valueCents,
    valueType: row.value_type,
    isSystem: row.is_system,
    createdAt: created instanceof Date ? created.toISOString() : String(created ?? ''),
    updatedAt: updated instanceof Date ? updated.toISOString() : String(updated ?? ''),
  };
}

function mapFeatureFlagRow(row: FeatureFlagRow): FeatureFlag {
  const created = row.created_at;
  const updated = row.updated_at;
  return {
    flagId: row.flag_id,
    tenantId: row.tenant_id,
    flagName: row.flag_name,
    description: row.description,
    isEnabled: row.is_enabled,
    rolloutPercentage: row.rollout_percentage,
    userWhitelist: row.user_whitelist ?? [],
    createdAt: created instanceof Date ? created.toISOString() : String(created ?? ''),
    updatedAt: updated instanceof Date ? updated.toISOString() : String(updated ?? ''),
  };
}

class ConfigService {
  // =====================
  // TENANT CONFIGS
  // =====================

  async getConfig(
    tenantId: string,
    module: string,
    key: string
  ): Promise<TenantConfig | null> {
    const row = await runQueryWithTenant<TenantConfigRow>(
      tenantId,
      `
      SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
      FROM tenant_configs
      WHERE module = $1 AND key = $2
      LIMIT 1
      `,
      [module, key]
    );

    if (!row) return null;
    return mapConfigRow(row);
  }

  async getConfigValue<T extends ConfigValue = ConfigValue>(
    tenantId: string,
    module: string,
    key: string
  ): Promise<T | null> {
    const cfg = await this.getConfig(tenantId, module, key);
    return (cfg?.valueCents as T) ?? null;
  }

  async getConfigValueOrDefault<T extends ConfigValue = ConfigValue>(
    tenantId: string,
    module: string,
    key: string,
    defaultValue: T
  ): Promise<T> {
    const cfg = await this.getConfig(tenantId, module, key);
    if (cfg == null || cfg.valueCents === undefined || cfg.valueCents === null) {
      return defaultValue;
    }
    return cfg.valueCents as T;
  }

  async setConfig(
    tenantId: string,
    module: string,
    key: string,
    valueCents: ConfigValue,
    options: ConfigSetOptions = {}
  ): Promise<TenantConfig> {
    const valueType = inferValueType(valueCents);
    const isSystem = options.isSystem ?? false;

    const jsonValue = valueType === 'json' ? JSON.stringify(valueCents) : valueCents;

    const existing = await this.getConfig(tenantId, module, key);

    const row = await runQueryWithTenant<TenantConfigRow>(
      tenantId,
      `
      INSERT INTO tenant_configs (tenant_id, module, key, value, value_type, is_system)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (tenant_id, module, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        value_type = EXCLUDED.value_type,
        is_system = EXCLUDED.is_system,
        updated_at = now()
      RETURNING config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
      `,
      [tenantId, module, key, jsonValue, valueType, isSystem]
    );

    if (!row) {
      throw new Error('Failed to set config');
    }

    const config = mapConfigRow(row);

    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: outboxEventIdFromSeed(
          `config.changed:${tenantId}:${module}:${key}:${config.updatedAt}`
        ),
        eventType: 'config.changed',
        eventVersion: 1,
        payload: {
          module,
          key,
          oldValue: existing?.valueCents ?? null,
          newValue: config.valueCents,
        },
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return config;
  }

  async deleteConfig(
    tenantId: string,
    module: string,
    key: string
  ): Promise<boolean> {
    const existing = await this.getConfig(tenantId, module, key);
    if (!existing) return false;

    await runQueryWithTenant<TenantConfigRow>(
      tenantId,
      `DELETE FROM tenant_configs WHERE module = $1 AND key = $2 RETURNING *`,
      [module, key]
    );

    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: outboxEventIdFromSeed(`config.deleted:${tenantId}:${module}:${key}`),
        eventType: 'config.deleted',
        eventVersion: 1,
        payload: { module, key, oldValue: existing.valueCents },
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return true;
  }

  async listConfigs(
    tenantId: string,
    module?: string,
    limit = 50,
    offset = 0
  ): Promise<TenantConfig[]> {
    let query: string;
    let params: unknown[];

    if (module) {
      query = `
        SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
        FROM tenant_configs
        WHERE module = $1
        ORDER BY module, key
        LIMIT $2 OFFSET $3
      `;
      params = [module, limit, offset];
    } else {
      query = `
        SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
        FROM tenant_configs
        ORDER BY module, key
        LIMIT $1 OFFSET $2
      `;
      params = [limit, offset];
    }

    const rows = await runQueriesWithTenant<TenantConfigRow>(tenantId, query, params);
    return rows.map(mapConfigRow);
  }

  // =====================
  // FEATURE FLAGS
  // =====================

  async getFeatureFlag(
    tenantId: string,
    flagName: string
  ): Promise<FeatureFlag | null> {
    const row = await runQueryWithTenant<FeatureFlagRow>(
      tenantId,
      `
      SELECT flag_id, tenant_id, flag_name, description, is_enabled,
             rollout_percentage, user_whitelist, created_at, updated_at
      FROM feature_flags
      WHERE flag_name = $1
      LIMIT 1
      `,
      [flagName]
    );

    if (!row) return null;
    return mapFeatureFlagRow(row);
  }

  async upsertFeatureFlag(
    tenantId: string,
    flagName: string,
    input: FeatureFlagUpsertInput
  ): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(tenantId, flagName);

    const description = input.description ?? existing?.description ?? null;
    const enabled = input.isEnabled ?? existing?.isEnabled ?? false;
    const rolloutPercentage = input.rolloutPercentage ?? existing?.rolloutPercentage ?? 100;
    const userWhitelist = input.userWhitelist ?? existing?.userWhitelist ?? [];

    const row = await runQueryWithTenant<FeatureFlagRow>(
      tenantId,
      `
      INSERT INTO feature_flags (
        tenant_id, flag_name, description, is_enabled,
        rollout_percentage, user_whitelist
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, flag_name)
      DO UPDATE SET
        description = EXCLUDED.description,
        is_enabled = EXCLUDED.is_enabled,
        rollout_percentage = EXCLUDED.rollout_percentage,
        user_whitelist = EXCLUDED.user_whitelist,
        updated_at = now()
      RETURNING flag_id, tenant_id, flag_name, description, is_enabled,
                rollout_percentage, user_whitelist, created_at, updated_at
      `,
      [tenantId, flagName, description, enabled, rolloutPercentage, userWhitelist]
    );

    if (!row) {
      throw new Error('Failed to upsert feature flag');
    }

    const flag = mapFeatureFlagRow(row);

    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: outboxEventIdFromSeed(
          `feature_flag.changed:${tenantId}:${flagName}:${flag.updatedAt}`
        ),
        eventType: 'feature_flag.changed',
        eventVersion: 1,
        payload: {
          flagName,
          old: existing ?? null,
          current: flag,
        },
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return flag;
  }

  async deleteFeatureFlag(
    tenantId: string,
    flagName: string
  ): Promise<boolean> {
    const existing = await this.getFeatureFlag(tenantId, flagName);
    if (!existing) return false;

    await runQueryWithTenant<FeatureFlagRow>(
      tenantId,
      `DELETE FROM feature_flags WHERE flag_name = $1 RETURNING *`,
      [flagName]
    );

    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: outboxEventIdFromSeed(`feature_flag.deleted:${tenantId}:${flagName}`),
        eventType: 'feature_flag.deleted',
        eventVersion: 1,
        payload: { flagName, old: existing },
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return true;
  }

  async listFeatureFlags(
    tenantId: string,
    limit = 50,
    offset = 0
  ): Promise<FeatureFlag[]> {
    const rows = await runQueriesWithTenant<FeatureFlagRow>(
      tenantId,
      `
      SELECT flag_id, tenant_id, flag_name, description, is_enabled,
             rollout_percentage, user_whitelist, created_at, updated_at
      FROM feature_flags
      ORDER BY flag_name
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return rows.map(mapFeatureFlagRow);
  }

  async isFeatureEnabled(
    tenantId: string,
    flagName: string,
    userId?: string
  ): Promise<boolean> {
    const flag = await this.getFeatureFlag(tenantId, flagName);
    if (!flag) return false;
    if (!flag.isEnabled) return false;

    if (userId && flag.userWhitelist.includes(userId)) {
      return true;
    }

    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;

    if (!userId) return false;

    const hash = this.deterministicHash(`${tenantId}:${flagName}:${userId}`);
    const bucket = hash % 100;

    return bucket < flag.rolloutPercentage;
  }

  private deterministicHash(input: string): number {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    return Math.abs(numericHash);
  }
}

export const configService = new ConfigService();

