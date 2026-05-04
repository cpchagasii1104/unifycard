// Domain event: dispatch de serviço aceito por um provider.

export type DispatchAcceptedEventPayload = {
  dispatchId: string;
  providerActorId: string;
  orderId: string;
};

/**
 * Evento de domínio publicado quando um dispatch é aceito.
 * event.type === DispatchAcceptedEvent.name para subscribe no EventBus.
 */
export class DispatchAcceptedEvent {
  readonly type = DispatchAcceptedEvent.name;
  readonly dispatchId: string;
  readonly providerActorId: string;
  readonly orderId: string;

  constructor(payload: DispatchAcceptedEventPayload) {
    this.dispatchId = payload.dispatchId;
    this.providerActorId = payload.providerActorId;
    this.orderId = payload.orderId;
  }
}