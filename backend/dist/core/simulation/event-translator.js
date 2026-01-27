"use strict";
// src/core/simulation/event-translator.ts
// Utilitário para traduzir eventos do event_log para CanonicalEvent
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateEventToCanonical = translateEventToCanonical;
/**
 * Mapeia tipos de eventos do Work para tipos canônicos
 */
function mapWorkEventType(eventType) {
    if (eventType === 'work.assignment.paid' || eventType === 'work_assignment_payment') {
        return 'payment.processed';
    }
    if (eventType === 'work.assignment.completed') {
        return 'service.completed';
    }
    if (eventType === 'work.job.created') {
        return 'service.created';
    }
    if (eventType === 'work.assignment.created') {
        return 'transaction.created';
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
    return payload?.workerUserId || payload?.clientUserId || payload?.userId || undefined;
}
/**
 * Extrai amount do payload
 */
function extractAmount(payload) {
    if (typeof payload?.amount === 'number') {
        return payload.amount;
    }
    if (typeof payload?.agreedRate === 'number') {
        return payload.agreedRate;
    }
    if (typeof payload?.totalAmount === 'number') {
        return payload.totalAmount;
    }
    return undefined;
}
/**
 * Traduz evento do event_log para formato canônico
 */
function translateEventToCanonical(event) {
    try {
        const payload = event.payload;
        const metadata = event.metadata || {};
        // Apenas eventos do Work por enquanto
        if (!event.type.startsWith('work.')) {
            return null;
        }
        const canonicalType = mapWorkEventType(event.type);
        // Extrair informações do payload
        const regionId = extractRegionId(payload, metadata);
        const userId = extractUserId(payload);
        const amount = extractAmount(payload);
        // Construir evento canônico
        const canonicalEvent = {
            eventId: event.eventId,
            eventType: canonicalType,
            sourceModule: 'work',
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
        console.error('[EventTranslator] Erro ao traduzir evento:', error);
        return null;
    }
}
