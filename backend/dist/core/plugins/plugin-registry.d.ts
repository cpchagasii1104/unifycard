import type { PluginLogger, UnificardPlugin } from './plugin.types';
/**
 * Registry central de plugins.
 * Kernel sabe apenas disso – não conhece plugins concretos.
 */
declare class PluginRegistry {
    private plugins;
    register(plugin: UnificardPlugin): void;
    list(): UnificardPlugin[];
    initAll(logger: PluginLogger): Promise<void>;
    startAll(logger: PluginLogger): Promise<void>;
    stopAll(logger: PluginLogger): Promise<void>;
}
export declare const pluginRegistry: PluginRegistry;
export {};
//# sourceMappingURL=plugin-registry.d.ts.map