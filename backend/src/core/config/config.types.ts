// backend/src/core/config/config.types.ts

export type ConfigPrimitive = string | number | boolean;
export type ConfigValue = ConfigPrimitive | Record<string, unknown> | Array<unknown>;

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

// ---------------------
// DB row types
// ---------------------
export interface TenantConfigRow {
  config_id: string;
  tenant_id: string;
  module: string;
  key: string;
  valueCents: unknown;
  value_type: ConfigValueType;
  is_system: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagRow {
  flag_id: string;
  tenant_id: string;
  flag_name: string;
  description: string | null;
  isEnabled: boolean;
  rollout_percentage: number;
  user_whitelist: string[] | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------
// Domain models
// ---------------------
export interface TenantConfig {
  configId: string;
  tenantId: string;
  module: string;
  key: string;
  valueCents: ConfigValue;
  valueType: ConfigValueType;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  flagId: string;
  tenantId: string;
  flagName: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPercentage: number;
  userWhitelist: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------
// Inputs / options
// ---------------------
export interface ConfigSetOptions {
  isSystem?: boolean;
}

export interface ListConfigsOptions {
  module?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertFlagInput {
  isEnabled: boolean;
  rolloutPercentage?: number;
  userWhitelist?: string[];
}

export interface FeatureFlagUpsertInput {
  description?: string;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  userWhitelist?: string[];
}

export interface CheckFlagForUserOptions {
  userId?: string;
}



