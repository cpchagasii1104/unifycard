"use strict";
// src/core/orchestrator/canonical-orchestrator.service.ts
// Serviço de orquestração canônica - recebe e loga eventos canônicos
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalOrchestrator = void 0;
class CanonicalOrchestratorService {
    /**
     * Recebe um evento canônico e processa (apenas logging por enquanto)
     */
    async receiveEvent(event) {
        // Log estruturado obrigatório
        console.log(JSON.stringify({
            module: 'orchestrator',
            eventType: 'canonical_event_received',
            sourceModule: event.sourceModule,
            tenantId: event.tenantId,
            regionId: event.regionId || null,
            amountCents: event.amount || null,
            occurredAt: event.occurredAt,
            canonicalEventId: event.eventId,
            canonicalEventType: event.eventType,
            userId: event.userId || null,
            currency: event.currency || null,
        }));
        // Por enquanto, apenas logar
        // Futuramente: IA, Capital, Governança podem ser ativados aqui
        // sem alterar módulos existentes
    }
}
exports.canonicalOrchestrator = new CanonicalOrchestratorService();
