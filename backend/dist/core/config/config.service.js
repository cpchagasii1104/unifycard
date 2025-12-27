"use strict";
// src/core/config/config.service.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = void 0;
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
const crypto = __importStar(require("crypto"));
function inferValueType(value) {
    if (typeof value === 'string')
        return 'string';
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'boolean')
        return 'boolean';
    return 'json';
}
function mapConfigRow(row) {
    let value = row.value;
    if (row.value_type === 'json' && typeof row.value === 'string') {
        try {
            value = JSON.parse(row.value);
        }
        catch {
            value = row.value;
        }
    }
    return {
        configId: row.config_id,
        tenantId: row.tenant_id,
        module: row.module,
        key: row.key,
        value,
        valueType: row.value_type,
        isSystem: row.is_system,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapFeatureFlagRow(row) {
    return {
        flagId: row.flag_id,
        tenantId: row.tenant_id,
        flagName: row.flag_name,
        description: row.description,
        enabled: row.enabled,
        rolloutPercentage: row.rollout_percentage,
        userWhitelist: row.user_whitelist ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
class ConfigService {
    // =====================
    // TENANT CONFIGS
    // =====================
    async getConfig(tenantId, module, key) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
      FROM tenant_configs
      WHERE module = $1 AND key = $2
      LIMIT 1
      `, [module, key]);
        if (!row)
            return null;
        return mapConfigRow(row);
    }
    async getConfigValue(tenantId, module, key) {
        const cfg = await this.getConfig(tenantId, module, key);
        return cfg?.value ?? null;
    }
    async getConfigValueOrDefault(tenantId, module, key, defaultValue) {
        const cfg = await this.getConfig(tenantId, module, key);
        if (cfg == null || cfg.value === undefined || cfg.value === null) {
            return defaultValue;
        }
        return cfg.value;
    }
    async setConfig(tenantId, module, key, value, options = {}) {
        const valueType = inferValueType(value);
        const isSystem = options.isSystem ?? false;
        const jsonValue = valueType === 'json' ? JSON.stringify(value) : value;
        const existing = await this.getConfig(tenantId, module, key);
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO tenant_configs (tenant_id, module, key, value, value_type, is_system)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (tenant_id, module, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        value_type = EXCLUDED.value_type,
        is_system = EXCLUDED.is_system,
        updated_at = now()
      RETURNING config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
      `, [tenantId, module, key, jsonValue, valueType, isSystem]);
        if (!row) {
            throw new Error('Failed to set config');
        }
        const config = mapConfigRow(row);
        await event_bus_1.eventBus.publish({
            type: 'config.changed',
            tenantId,
            payload: {
                module,
                key,
                oldValue: existing?.value ?? null,
                newValue: config.value,
            },
        });
        return config;
    }
    async deleteConfig(tenantId, module, key) {
        const existing = await this.getConfig(tenantId, module, key);
        if (!existing)
            return false;
        await (0, pool_1.runQueryWithTenant)(tenantId, `DELETE FROM tenant_configs WHERE module = $1 AND key = $2 RETURNING *`, [module, key]);
        await event_bus_1.eventBus.publish({
            type: 'config.deleted',
            tenantId,
            payload: { module, key, oldValue: existing.value },
        });
        return true;
    }
    async listConfigs(tenantId, module, limit = 50, offset = 0) {
        let query;
        let params;
        if (module) {
            query = `
        SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
        FROM tenant_configs
        WHERE module = $1
        ORDER BY module, key
        LIMIT $2 OFFSET $3
      `;
            params = [module, limit, offset];
        }
        else {
            query = `
        SELECT config_id, tenant_id, module, key, value, value_type, is_system, created_at, updated_at
        FROM tenant_configs
        ORDER BY module, key
        LIMIT $1 OFFSET $2
      `;
            params = [limit, offset];
        }
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        return rows.map(mapConfigRow);
    }
    // =====================
    // FEATURE FLAGS
    // =====================
    async getFeatureFlag(tenantId, flagName) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT flag_id, tenant_id, flag_name, description, enabled,
             rollout_percentage, user_whitelist, created_at, updated_at
      FROM feature_flags
      WHERE flag_name = $1
      LIMIT 1
      `, [flagName]);
        if (!row)
            return null;
        return mapFeatureFlagRow(row);
    }
    async upsertFeatureFlag(tenantId, flagName, input) {
        const existing = await this.getFeatureFlag(tenantId, flagName);
        const description = input.description ?? existing?.description ?? null;
        const enabled = input.enabled ?? existing?.enabled ?? false;
        const rolloutPercentage = input.rolloutPercentage ?? existing?.rolloutPercentage ?? 100;
        const userWhitelist = input.userWhitelist ?? existing?.userWhitelist ?? [];
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO feature_flags (
        tenant_id, flag_name, description, enabled,
        rollout_percentage, user_whitelist
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, flag_name)
      DO UPDATE SET
        description = EXCLUDED.description,
        enabled = EXCLUDED.enabled,
        rollout_percentage = EXCLUDED.rollout_percentage,
        user_whitelist = EXCLUDED.user_whitelist,
        updated_at = now()
      RETURNING flag_id, tenant_id, flag_name, description, enabled,
                rollout_percentage, user_whitelist, created_at, updated_at
      `, [tenantId, flagName, description, enabled, rolloutPercentage, userWhitelist]);
        if (!row) {
            throw new Error('Failed to upsert feature flag');
        }
        const flag = mapFeatureFlagRow(row);
        await event_bus_1.eventBus.publish({
            type: 'feature_flag.changed',
            tenantId,
            payload: {
                flagName,
                old: existing ?? null,
                current: flag,
            },
        });
        return flag;
    }
    async deleteFeatureFlag(tenantId, flagName) {
        const existing = await this.getFeatureFlag(tenantId, flagName);
        if (!existing)
            return false;
        await (0, pool_1.runQueryWithTenant)(tenantId, `DELETE FROM feature_flags WHERE flag_name = $1 RETURNING *`, [flagName]);
        await event_bus_1.eventBus.publish({
            type: 'feature_flag.deleted',
            tenantId,
            payload: { flagName, old: existing },
        });
        return true;
    }
    async listFeatureFlags(tenantId, limit = 50, offset = 0) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT flag_id, tenant_id, flag_name, description, enabled,
             rollout_percentage, user_whitelist, created_at, updated_at
      FROM feature_flags
      ORDER BY flag_name
      LIMIT $1 OFFSET $2
      `, [limit, offset]);
        return rows.map(mapFeatureFlagRow);
    }
    async isFeatureEnabled(tenantId, flagName, userId) {
        const flag = await this.getFeatureFlag(tenantId, flagName);
        if (!flag)
            return false;
        if (!flag.enabled)
            return false;
        if (userId && flag.userWhitelist.includes(userId)) {
            return true;
        }
        if (flag.rolloutPercentage >= 100)
            return true;
        if (flag.rolloutPercentage <= 0)
            return false;
        if (!userId)
            return false;
        const hash = this.deterministicHash(`${tenantId}:${flagName}:${userId}`);
        const bucket = hash % 100;
        return bucket < flag.rolloutPercentage;
    }
    deterministicHash(input) {
        const hash = crypto.createHash('sha256').update(input).digest('hex');
        const numericHash = parseInt(hash.substring(0, 8), 16);
        return Math.abs(numericHash);
    }
}
exports.configService = new ConfigService();
//# sourceMappingURL=config.service.js.map