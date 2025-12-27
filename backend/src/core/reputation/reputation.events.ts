// backend/src/core/reputation/reputation.events.ts

import type { EventBus, DomainEvent } from '@core/events/event-bus';
import { reputationService } from './reputation.service';
import type { ReviewCreatedEventPayload } from './reputation.types';

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
export function registerReputationEventHandlers(eventBus: EventBus) {
  eventBus.subscribe(
    'core.review.created',
    async (event: DomainEvent) => {
      const { tenantId } = event;
      const payload = event.payload as unknown as ReviewCreatedEventPayload;

      // Atualiza o score da entidade avaliada
      await reputationService.applyReview(tenantId, payload);
    },
  );

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
