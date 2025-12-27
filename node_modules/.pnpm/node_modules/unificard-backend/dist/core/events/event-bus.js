"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("@core/database/pool");
// ⭐ REPUTATION HANDLERS
const reputation_events_1 = require("@core/reputation/reputation.events");
// ⭐ NOTIFY HANDLERS (Work + futuros módulos)
const handlers_1 = require("@core/notify/handlers");
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
     * 1. Persiste no event_log (idempotência via conflict)
     * 2. Executa handlers registrados
     */
    async publish(event) {
        const fullEvent = {
            ...event,
            eventId: event.eventId ?? (0, uuid_1.v4)(),
            createdAt: new Date(),
            version: event.version ?? 1,
        };
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
                console.error(`[EventBus] Handler error for "${fullEvent.type}"`, error);
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
// ============================================================
// ⭐ REGISTRO GLOBAL DE HANDLERS
// ============================================================
// 🔥 Reputation (escuta core.review.created)
(0, reputation_events_1.registerReputationEventHandlers)(exports.eventBus);
// 🔥 Notify (escuta eventos do Work e outros módulos)
(0, handlers_1.registerAllNotifyHandlers)(exports.eventBus);
// 🔥 Orchestrator Work Handlers (escuta eventos do Work para Memory/AI)
const work_executors_1 = require("../orchestrator/executors/work.executors");
exports.eventBus.registerHandler('work.job.created', work_executors_1.onJobCreated);
exports.eventBus.registerHandler('work.assignment.completed', work_executors_1.onAssignmentCompleted);
// 🔥 Groups Handlers (escuta eventos de grupos para Memory/AI)
const groups_executors_1 = require("../orchestrator/executors/groups.executors");
exports.eventBus.registerHandler('group.created', groups_executors_1.handleGroupCreated);
exports.eventBus.registerHandler('group.member.joined', groups_executors_1.handleGroupMemberJoined);
exports.eventBus.registerHandler('group.member.left', groups_executors_1.handleGroupMemberLeft);
exports.eventBus.registerHandler('group.fund.received', groups_executors_1.handleGroupFundReceived);
// 🔥 Groups Activity Handlers (cria auto-posts econômicos)
const groups_activity_executors_1 = require("../orchestrator/executors/groups-activity.executors");
exports.eventBus.registerHandler('group.fund.received', groups_activity_executors_1.onGroupFundReceived);
// 🔥 Canonical Event Adapters (tradução para formato canônico)
const work_adapter_1 = require("../orchestrator/adapters/work.adapter");
const rides_adapter_1 = require("../orchestrator/adapters/rides.adapter");
(0, work_adapter_1.registerWorkAdapters)();
(0, rides_adapter_1.registerRidesAdapters)();
// EventBus agora está 100% integrado ao ecossistema
//# sourceMappingURL=event-bus.js.map