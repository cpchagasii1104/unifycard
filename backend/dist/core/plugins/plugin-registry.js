"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = void 0;
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
/**
 * Registry central de plugins.
 * Kernel sabe apenas disso – não conhece plugins concretos.
 */
class PluginRegistry {
    plugins = new Map();
    register(plugin) {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin já registrado: ${plugin.name}`);
        }
        this.plugins.set(plugin.name, plugin);
    }
    list() {
        return Array.from(this.plugins.values());
    }
    async initAll(logger) {
        const ctx = { eventBus: event_bus_1.eventBus, db: pool_1.pool, logger };
        for (const plugin of this.plugins.values()) {
            if (plugin.init) {
                await plugin.init(ctx);
            }
        }
    }
    async startAll(logger) {
        const ctx = { eventBus: event_bus_1.eventBus, db: pool_1.pool, logger };
        for (const plugin of this.plugins.values()) {
            if (plugin.start) {
                await plugin.start(ctx);
            }
        }
    }
    async stopAll(logger) {
        const ctx = { eventBus: event_bus_1.eventBus, db: pool_1.pool, logger };
        for (const plugin of this.plugins.values()) {
            if (plugin.stop) {
                await plugin.stop(ctx);
            }
        }
    }
}
exports.pluginRegistry = new PluginRegistry();
