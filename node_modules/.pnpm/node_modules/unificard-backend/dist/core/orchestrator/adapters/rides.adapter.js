"use strict";
// src/core/orchestrator/adapters/rides.adapter.ts
// Adapter para traduzir eventos do módulo Rides para formato canônico
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRidesEvent = handleRidesEvent;
exports.registerRidesAdapters = registerRidesAdapters;
const canonical_orchestrator_service_1 = require("../canonical-orchestrator.service");
/**
 * Mapeia tipos de eventos do Rides para tipos canônicos
 */
function mapRidesEventType(eventType) {
    if (eventType.includes('payment') || eventType.includes('paid')) {
        return 'payment.processed';
    }
    if (eventType.includes('completed') || eventType.includes('finished')) {
        return 'service.completed';
    }
    if (eventType.includes('created') || eventType.includes('requested')) {
        return 'service.created';
    }
    return 'other';
}
/**
 * Extrai regionId do payload ou metadata
 */
function extractRegionId(payload, metadata) {
    return (payload?.regionId ||
        payload?.regionAccountId ||
        metadata?.regionId ||
        metadata?.regionAccountId ||
        undefined);
}
/**
 * Extrai userId do payload
 */
function extractUserId(payload) {
    return payload?.riderUserId || payload?.driverUserId || payload?.userId || undefined;
}
/**
 * Extrai amount do payload
 */
function extractAmount(payload) {
    if (typeof payload?.amount === 'number') {
        return payload.amount;
    }
    if (typeof payload?.fare === 'number') {
        return payload.fare;
    }
    if (typeof payload?.totalAmount === 'number') {
        return payload.totalAmount;
    }
    return undefined;
}
/**
 * Traduz evento do Rides para formato canônico
 */
function translateRidesEvent(event) {
    try {
        const payload = event.payload;
        const metadata = event.metadata || {};
        const canonicalType = mapRidesEventType(event.type);
        // Extrair informações do payload
        const regionId = extractRegionId(payload, metadata);
        const userId = extractUserId(payload);
        const amount = extractAmount(payload);
        // Construir evento canônico
        const canonicalEvent = {
            eventId: event.eventId,
            eventType: canonicalType,
            sourceModule: 'rides',
            tenantId: event.tenantId,
            regionId,
            userId,
            amount,
            currency: payload?.currency || metadata?.currency || 'BRL',
            occurredAt: event.createdAt.toISOString(),
            metadata: {
                originalEventType: event.type,
                ...payload,
                ...metadata,
            },
        };
        return canonicalEvent;
    }
    catch (error) {
        console.error('[RidesAdapter] Erro ao traduzir evento:', error);
        return null;
    }
}
/**
 * Handler para eventos do Rides
 */
async function handleRidesEvent(event) {
    // Filtrar apenas eventos do Rides
    if (!event.type.startsWith('rides.')) {
        return;
    }
    const canonicalEvent = translateRidesEvent(event);
    if (!canonicalEvent) {
        return; // Evento não pôde ser traduzido
    }
    // Enviar para o orchestrator canônico
    await canonical_orchestrator_service_1.canonicalOrchestrator.receiveEvent(canonicalEvent);
}
/**
 * Registra handlers para todos os tipos de eventos do Rides
 */
function registerRidesAdapters() {
    // Importar eventBus de forma segura (evitar circular dependency)
    const { eventBus } = require('@core/events/event-bus');
    // Eventos principais do Rides (se existirem)
    const ridesEventTypes = [
        'rides.ride.created',
        'rides.ride.completed',
        'rides.ride.paid',
        'rides.ride.cancelled',
    ];
    for (const eventType of ridesEventTypes) {
        try {
            eventBus.registerHandler(eventType, handleRidesEvent);
        }
        catch (error) {
            console.warn(`[RidesAdapter] Erro ao registrar handler para ${eventType}:`, error);
        }
    }
}
//# sourceMappingURL=rides.adapter.js.map