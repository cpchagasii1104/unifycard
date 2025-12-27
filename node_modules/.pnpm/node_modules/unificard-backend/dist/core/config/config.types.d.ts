export type ConfigPrimitive = string | number | boolean;
export type ConfigValue = ConfigPrimitive | Record<string, unknown> | Array<unknown>;
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';
export interface TenantConfigRow {
    config_id: string;
    tenant_id: string;
    module: string;
    key: string;
    value: unknown;
    value_type: ConfigValueType;
    is_system: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface FeatureFlagRow {
    flag_id: string;
    tenant_id: string;
    flag_name: string;
    description: string | null;
    enabled: boolean;
    rollout_percentage: number;
    user_whitelist: string[] | null;
    created_at: Date;
    updated_at: Date;
}
export interface TenantConfig {
    configId: string;
    tenantId: string;
    module: string;
    key: string;
    value: ConfigValue;
    valueType: ConfigValueType;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface FeatureFlag {
    flagId: string;
    tenantId: string;
    flagName: string;
    description: string | null;
    enabled: boolean;
    rolloutPercentage: number;
    userWhitelist: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface ConfigSetOptions {
    isSystem?: boolean;
}
export interface ListConfigsOptions {
    module?: string;
    limit?: number;
    offset?: number;
}
export interface UpsertFlagInput {
    enabled: boolean;
    rolloutPercentage?: number;
    userWhitelist?: string[];
}
export interface FeatureFlagUpsertInput {
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    userWhitelist?: string[];
}
export interface CheckFlagForUserOptions {
    userId?: string;
}
//# sourceMappingURL=config.types.d.ts.map