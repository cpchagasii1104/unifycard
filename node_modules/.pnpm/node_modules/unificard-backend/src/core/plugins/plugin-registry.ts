import { pool } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import type { PluginContext, PluginLogger, UnificardPlugin } from './plugin.types';

/**
 * Registry central de plugins.
 * Kernel sabe apenas disso – não conhece plugins concretos.
 */
class PluginRegistry {
  private plugins = new Map<string, UnificardPlugin>();

  register(plugin: UnificardPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin já registrado: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  list(): UnificardPlugin[] {
    return Array.from(this.plugins.values());
  }

  async initAll(logger: PluginLogger): Promise<void> {
    const ctx: PluginContext = { eventBus, db: pool, logger };
    for (const plugin of this.plugins.values()) {
      if (plugin.init) {
        await plugin.init(ctx);
      }
    }
  }

  async startAll(logger: PluginLogger): Promise<void> {
    const ctx: PluginContext = { eventBus, db: pool, logger };
    for (const plugin of this.plugins.values()) {
      if (plugin.start) {
        await plugin.start(ctx);
      }
    }
  }

  async stopAll(logger: PluginLogger): Promise<void> {
    const ctx: PluginContext = { eventBus, db: pool, logger };
    for (const plugin of this.plugins.values()) {
      if (plugin.stop) {
        await plugin.stop(ctx);
      }
    }
  }
}

export const pluginRegistry = new PluginRegistry();
