"use strict";
// src/core/orchestrator/adapters/work.adapter.ts
// Adapter para traduzir eventos do módulo Work para formato canônico
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWorkEvent = handleWorkEvent;
exports.registerWorkAdapters = registerWorkAdapters;
const canonical_orchestrator_service_1 = require("../canonical-orchestrator.service");
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
    // Tentar de várias fontes
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
 * Traduz evento do Work para formato canônico
 */
function translateWorkEvent(event) {
    try {
        const payload = event.payload;
        const metadata = event.metadata || {};
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
        console.error('[WorkAdapter] Erro ao traduzir evento:', error);
        return null;
    }
}
/**
 * Handler para eventos do Work
 *
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleWorkEvent(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        console.error('[WorkAdapter] ❌ Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for work event handler');
    }
    // Filtrar apenas eventos do Work
    if (!event.type.startsWith('work.')) {
        return;
    }
    const canonicalEvent = translateWorkEvent(event);
    if (!canonicalEvent) {
        return; // Evento não pôde ser traduzido
    }
    // Enviar para o orchestrator canônico
    await canonical_orchestrator_service_1.canonicalOrchestrator.receiveEvent(canonicalEvent);
}
/**
 * Registra handlers para todos os tipos de eventos do Work
 */
async function registerWorkAdapters() {
    // Importar eventBus de forma segura (evitar circular dependency)
    const { eventBus } = await Promise.resolve().then(() => __importStar(require('@core/events/event-bus')));
    // Eventos principais do Work que devem ser traduzidos
    const workEventTypes = [
        'work.job.created',
        'work.assignment.created',
        'work.assignment.completed',
        'work.assignment.paid',
        'work.application.created',
        'work.worker.created',
        'work.worker.updated',
    ];
    for (const eventType of workEventTypes) {
        try {
            eventBus.registerHandler(eventType, handleWorkEvent);
        }
        catch (error) {
            console.warn(`[WorkAdapter] Erro ao registrar handler para ${eventType}:`, error);
        }
    }
}
