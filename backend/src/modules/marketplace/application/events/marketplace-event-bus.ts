// backend/src/modules/marketplace/application/events/marketplace-event-bus.ts
// Singleton do Event Bus do módulo marketplace (evita múltiplas instâncias).

import { EventBus } from './event-bus';

// EVENT BUS INTERNO DO MARKETPLACE — comunicação síncrona intra-módulo.
//
// NÃO é o event bus canônico do sistema (core/events/event-bus.ts).
// NÃO exportar para fora do módulo marketplace.
// NÃO usar para eventos cross-domain ou que exijam garantia transacional.
//
// Para eventos cross-domain ou com garantia de entrega:
// usar event_outbox conforme EVENT_OUTBOX_E_ENTREGA_CANONICO.md §2.

export const marketplaceEventBus = new EventBus();