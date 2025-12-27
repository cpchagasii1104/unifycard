import type { EventBus } from '@core/events/event-bus';
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
export declare function registerReputationEventHandlers(eventBus: EventBus): void;
//# sourceMappingURL=reputation.events.d.ts.map