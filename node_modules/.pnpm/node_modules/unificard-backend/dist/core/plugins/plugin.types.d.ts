import type { Pool } from 'pg';
import { eventBus } from '@core/events/event-bus';
export interface PluginLogger {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}
export interface PluginContext {
    eventBus: typeof eventBus;
    db: Pool;
    logger: PluginLogger;
}
/**
 * Contrato básico de qualquer plugin Unificard.
 * Plugins podem implementar só o que precisam.
 */
export interface UnificardPlugin {
    name: string;
    version: string;
    description?: string;
    init?(ctx: PluginContext): Promise<void> | void;
    start?(ctx: PluginContext): Promise<void> | void;
    stop?(ctx: PluginContext): Promise<void> | void;
}
//# sourceMappingURL=plugin.types.d.ts.map