import { ConfigValue, TenantConfig, FeatureFlag, ConfigSetOptions, FeatureFlagUpsertInput } from './config.types';
declare class ConfigService {
    getConfig(tenantId: string, module: string, key: string): Promise<TenantConfig | null>;
    getConfigValue<T extends ConfigValue = ConfigValue>(tenantId: string, module: string, key: string): Promise<T | null>;
    getConfigValueOrDefault<T extends ConfigValue = ConfigValue>(tenantId: string, module: string, key: string, defaultValue: T): Promise<T>;
    setConfig(tenantId: string, module: string, key: string, value: ConfigValue, options?: ConfigSetOptions): Promise<TenantConfig>;
    deleteConfig(tenantId: string, module: string, key: string): Promise<boolean>;
    listConfigs(tenantId: string, module?: string, limit?: number, offset?: number): Promise<TenantConfig[]>;
    getFeatureFlag(tenantId: string, flagName: string): Promise<FeatureFlag | null>;
    upsertFeatureFlag(tenantId: string, flagName: string, input: FeatureFlagUpsertInput): Promise<FeatureFlag>;
    deleteFeatureFlag(tenantId: string, flagName: string): Promise<boolean>;
    listFeatureFlags(tenantId: string, limit?: number, offset?: number): Promise<FeatureFlag[]>;
    isFeatureEnabled(tenantId: string, flagName: string, userId?: string): Promise<boolean>;
    private deterministicHash;
}
export declare const configService: ConfigService;
export {};
//# sourceMappingURL=config.service.d.ts.map