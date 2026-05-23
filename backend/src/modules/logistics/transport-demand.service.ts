/**
 * Fachada mínima sobre TransportDemand (validação de forma).
 * Persistência, IDs de tenant e ligação a pedidos de marketplace são P2+.
 */
import { BadRequestError } from '@core/errors';
import type { TransportDemand } from './logistics.types';

class TransportDemandService {
  assertValidShape(demand: TransportDemand): void {
    if (!demand || typeof demand !== 'object') {
      throw new BadRequestError('TransportDemand inválido.');
    }
    if (!['food', 'passenger', 'cargo'].includes(demand.type)) {
      throw new BadRequestError('TransportDemand.type inválido.');
    }
    if (typeof demand.weight !== 'number' || demand.weight < 0) {
      throw new BadRequestError('TransportDemand.weight inválido.');
    }
    if (typeof demand.volume !== 'number' || demand.volume < 0) {
      throw new BadRequestError('TransportDemand.volume inválido.');
    }
    if (!Number.isInteger(demand.passengers) || demand.passengers < 0) {
      throw new BadRequestError('TransportDemand.passengers inválido.');
    }
    if (!['low', 'normal', 'high'].includes(demand.urgency)) {
      throw new BadRequestError('TransportDemand.urgency inválido.');
    }
    this.assertPoint(demand.origin, 'origin');
    this.assertPoint(demand.destination, 'destination');
  }

  private assertPoint(p: { lat?: number; lng?: number }, label: string): void {
    if (
      !p ||
      typeof p.lat !== 'number' ||
      typeof p.lng !== 'number' ||
      Number.isNaN(p.lat) ||
      Number.isNaN(p.lng)
    ) {
      throw new BadRequestError(`TransportDemand.${label} inválido.`);
    }
  }
}

export const transportDemandService = new TransportDemandService();