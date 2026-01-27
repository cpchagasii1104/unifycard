"use strict";
// backend/src/core/reputation/reputation.events.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReputationEventHandlers = registerReputationEventHandlers;
const reputation_service_1 = require("./reputation.service");
const idempotency_tracker_1 = require("@core/events/idempotency-tracker");
const canonical_logger_1 = require("@core/logging/canonical-logger");
/**
 * Registra handlers do módulo Reputation dentro do EventBus.
 *
 * Esse módulo escuta qualquer evento de review criado pelo core/reviews
 * e atualiza automaticamente o score de reputação da entidade alvo.
 *
 * Evento capturado:
 *    core.review.created
 *
 * Isso garante:
 *    - reputação global
 *    - reputação transversal entre módulos (work, rides, food etc)
 *    - acoplamento zero entre módulos de negócio e o Reputation
 *    - idempotência (replay não causa efeitos colaterais)
 */
function registerReputationEventHandlers(eventBus) {
    eventBus.subscribe('core.review.created', async (event) => {
        // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
        if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
            canonical_logger_1.canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
                eventType: event.type,
                eventId: event.eventId,
                tenantId: event.tenantId,
            });
            throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for reputation handler');
        }
        const { tenantId } = event;
        const payload = event.payload;
        // 🔴 IDEMPOTÊNCIA: Garantir que replay não causa efeitos colaterais
        await (0, idempotency_tracker_1.withIdempotency)(tenantId, event.eventId, event.type, 'reputation.applyReview', payload, async () => {
            // Atualiza o score da entidade avaliada
            const result = await reputation_service_1.reputationService.applyReview(tenantId, payload);
            return result;
        });
    });
    // 🔮 FUTURO:
    // Se módulos antigos gerarem eventos legados (ex.: 'work.review.created'),
    // podemos mapear assim:
    //
    // eventBus.subscribe('work.review.created', async (event) => {
    //   const mappedPayload: ReviewCreatedEventPayload = {
    //     // normalizar dados legacy → payload universal
    //   };
    //   await reputationService.applyReview(event.tenantId, mappedPayload);
    // });
}
