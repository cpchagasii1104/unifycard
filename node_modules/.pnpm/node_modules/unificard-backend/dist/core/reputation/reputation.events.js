"use strict";
// backend/src/core/reputation/reputation.events.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReputationEventHandlers = registerReputationEventHandlers;
const reputation_service_1 = require("./reputation.service");
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
 */
function registerReputationEventHandlers(eventBus) {
    eventBus.subscribe('core.review.created', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        // Atualiza o score da entidade avaliada
        await reputation_service_1.reputationService.applyReview(tenantId, payload);
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
//# sourceMappingURL=reputation.events.js.map