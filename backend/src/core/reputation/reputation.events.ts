// backend/src/core/reputation/reputation.events.ts

import type { EventBus, DomainEvent } from '@core/events/event-bus';
import { reputationService } from './reputation.service';
import type { ReviewCreatedEventPayload } from './reputation.types';
import { withIdempotency } from '@core/events/idempotency-tracker';
import { canonicalLogger } from '@core/logging/canonical-logger';

/** 3.º segmento da chave canónica §4.12.1 (07_NOMENCLATURA_CANONICA). */
const REPUTATION_APPLY_REVIEW_HANDLER = 'reputation.applyReview';

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
export function registerReputationEventHandlers(eventBus: EventBus) {
  eventBus.subscribe(
    'core.review.created',
    REPUTATION_APPLY_REVIEW_HANDLER,
    async (event: DomainEvent) => {
      // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
      if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
          eventType: event.type,
          eventId: event.eventId,
          tenantId: event.tenantId,
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for reputation handler');
      }

      const { tenantId } = event;
      const payload = event.payload as unknown as ReviewCreatedEventPayload;

      // 🔴 IDEMPOTÊNCIA — §4.12.1: forma canónica semântica
      //   ${event.type}:${reference_id}:${handler_name}
      //   ex.: core.review.created:${payload.reviewId}:reputation.applyReview
      await withIdempotency(
        tenantId,
        event.eventId,
        event.type,
        REPUTATION_APPLY_REVIEW_HANDLER,
        payload,
        async () => {
          // Atualiza o score da entidade avaliada
          const result = await reputationService.applyReview(tenantId, payload);
          return result;
        }
      );
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
