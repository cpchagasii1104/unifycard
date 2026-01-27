"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("@core/database/pool");
const canonical_logger_1 = require("@core/logging/canonical-logger");
/**
 * EventBus simples e robusto:
 * - Persistência antes dos handlers (garante idempotência real)
 * - Handlers registrados em memória para alto desempenho
 * - Módulos transversais plugam handlers de forma centralizada
 */
class EventBus {
    handlers = new Map();
    /**
     * Registra um handler para um tipo de evento específico
     */
    registerHandler(eventType, handler) {
        const list = this.handlers.get(eventType) ?? [];
        list.push(handler);
        this.handlers.set(eventType, list);
    }
    subscribe(eventType, handler) {
        this.registerHandler(eventType, handler);
    }
    /**
     * Publica um evento:
     * 1. Valida tenantId (fail-fast)
     * 2. Persiste no event_log (idempotência via conflict)
     * 3. Executa handlers registrados
     *
     * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
     * - tenantId é obrigatório e validado antes de qualquer processamento
     * - Nenhum evento executa fora de tenant válido
     * - Fail-fast se evento crítico vier sem contexto
     */
    async publish(event) {
        // 🔴 GUARD CANÔNICO: Validar tenantId antes de qualquer processamento
        if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
            const error = new Error(`EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required and must be a non-empty string. ` +
                `Event type: ${event.type}, EventId: ${event.eventId || 'N/A'}`);
            error.statusCode = 400;
            canonical_logger_1.canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
                eventType: event.type,
                eventId: event.eventId,
                tenantId: event.tenantId,
            });
            throw error;
        }
        const fullEvent = {
            ...event,
            eventId: event.eventId ?? (0, uuid_1.v4)(),
            createdAt: new Date(),
            version: event.version ?? 1,
        };
        // 🔴 LOG CANÔNICO: Evento publicado com contexto válido
        canonical_logger_1.canonicalLogger.info(null, 'Publicando evento', {
            eventType: fullEvent.type,
            eventId: fullEvent.eventId,
            tenantId: fullEvent.tenantId,
        });
        // ============================================================
        // 1) Persistência antes do processamento (garante idempotência)
        // ============================================================
        await (0, pool_1.runQueryWithTenant)(fullEvent.tenantId, `
        INSERT INTO event_log (event_id, tenant_id, event_type, event_version, payload, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO NOTHING
      `, [
            fullEvent.eventId,
            fullEvent.tenantId,
            fullEvent.type,
            fullEvent.version,
            fullEvent.payload,
            fullEvent.metadata ?? {},
        ]);
        // ============================================================
        // 2) Executar handlers registrados
        // ============================================================
        const handlers = this.handlers.get(fullEvent.type) ?? [];
        for (const handler of handlers) {
            try {
                await handler(fullEvent);
            }
            catch (error) {
                canonical_logger_1.canonicalLogger.error(null, `Handler error for "${fullEvent.type}"`, {
                    eventId: fullEvent.eventId,
                    tenantId: fullEvent.tenantId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }
    /**
     * Alias semântico para publish — mantém compatibilidade
     * com chamadas antigas que usam `eventBus.emit(...)`.
     */
    async emit(event) {
        return this.publish(event);
    }
}
exports.EventBus = EventBus;
exports.eventBus = new EventBus();
// ⚠️ REGISTRO DE HANDLERS FOI MOVIDO PARA register-handlers.ts
// Isso evita circular imports e problemas de TDZ (Temporal Dead Zone)
// Os handlers são registrados no bootstrap (server.ts) DEPOIS de tudo estar inicializado
