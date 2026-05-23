// src/core/events/event-refund-chargeback.service.ts
// Stub para Refund/Chargeback — implementação futura

import type { RequestRefundInput, InitiateChargebackInput } from './event-payment.types';

class EventRefundChargebackService {
  async hasFrozenExecutions(_tenantId: string, _eventId: string): Promise<boolean> {
    return false;
  }

  async requestRefund(_tenantId: string, _input: RequestRefundInput): Promise<{ refundId: string }> {
    throw new Error('EventRefundChargebackService.requestRefund not implemented');
  }

  async initiateChargeback(_tenantId: string, _input: InitiateChargebackInput): Promise<{ chargebackId: string }> {
    throw new Error('EventRefundChargebackService.initiateChargeback not implemented');
  }

  async resolveChargeback(
    _tenantId: string,
    _chargebackId: string,
    _resolvedByActorId: string,
    _resolution: 'accepted' | 'disputed',
    _resolutionReason?: string
  ): Promise<{ resolved: boolean }> {
    throw new Error('EventRefundChargebackService.resolveChargeback not implemented');
  }
}

export const eventRefundChargebackService = new EventRefundChargebackService();