// backend/src/modules/marketplace/application/events/event-bus.ts
// Event Bus interno: publicar e inscrever handlers por nome de evento (em memória).

// Eventos do bus precisam ter ao menos type (string) para roteamento.
// Permite classes e objetos sem index signature.
export type MarketplaceEvent = { type: string };

export type EventHandler<E extends MarketplaceEvent = MarketplaceEvent> = (event: E) => void;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  /**
   * Inscreve um handler para um nome de evento (tipado por evento).
   */
  subscribe<T extends MarketplaceEvent>(
    eventName: T['type'],
    handler: (event: T) => void
  ): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(eventName, list);
  }

  /**
   * Publica um evento (dispara todos os handlers inscritos para event.type).
   */
  publish<T extends MarketplaceEvent>(event: T): void {
    const name = event.type;
    const list = this.handlers.get(name) ?? [];
    for (const handler of list) {
      try {
        (handler as (e: T) => void)(event);
      } catch (err) {
        console.error(`[EventBus] handler error for "${name}":`, err);
      }
    }
  }
}