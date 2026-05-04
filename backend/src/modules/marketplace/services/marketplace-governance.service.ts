// backend/src/modules/marketplace/services/marketplace-governance.service.ts
// Agregador: SLA, reputação, disputas, penalidades, métricas de governança de serviços.
// Estado vive nos domain/compliance; facade não possui estado.

import type {
  SLAContract,
  ReputationSnapshot,
  DisputeCase,
  PaymentPlan,
} from '@contracts/marketplace';
import type { MarketplaceSlaModule } from '../domain/sla/marketplace-sla.service';
import type { DomainEvent } from '../core/event-bus';
import type { ServiceCompletedPayload } from '../core/events';

export class MarketplaceGovernanceAggregatorService {
  constructor(private readonly sla: MarketplaceSlaModule) {}

  createSLAContract(input: {
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    actorId: string;
    metrics: {
      fulfillmentTime: { targetHours: number; maxHours: number };
      cancellationRate: { targetPercentage: number; maxPercentage: number };
      disputeRate: { targetPercentage: number; maxPercentage: number };
    };
    thresholds: {
      warning: { fulfillmentTimeHours: number; cancellationRatePercentage: number; disputeRatePercentage: number };
      violation: { fulfillmentTimeHours: number; cancellationRatePercentage: number; disputeRatePercentage: number };
    };
    penalties: {
      fulfillmentTimeViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      cancellationRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      disputeRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
    };
  }): SLAContract {
    return this.sla.createSLAContract(input);
  }

  getSLAContract(slaId: string): SLAContract | null {
    return this.sla.getSLAContract(slaId);
  }

  getSLAContractByActor(
    actorId: string,
    actorType: 'store' | 'hub' | 'industry' | 'service_provider'
  ): SLAContract | null {
    return this.sla.getSLAContractByActor(actorId, actorType);
  }

  recordOrderEvent(input: {
    orderId: string;
    actorId: string;
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    eventType: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    fulfillmentTimeHours?: number;
  }): void {
    this.sla.recordOrderEvent(input);
  }

  generateReputationSnapshot(
    actorId: string,
    actorType: 'store' | 'hub' | 'industry' | 'service_provider',
    year: number,
    month: number
  ): ReputationSnapshot {
    return this.sla.generateReputationSnapshot(actorId, actorType, year, month);
  }

  getReputationSnapshots(actorId: string): ReputationSnapshot[] {
    return this.sla.getReputationSnapshots(actorId);
  }

  getReputationSnapshot(snapshotId: string): ReputationSnapshot | null {
    return this.sla.getReputationSnapshot(snapshotId);
  }

  applySLAPenaltiesToPaymentPlan(paymentPlanId: string): PaymentPlan {
    return this.sla.applySLAPenaltiesToPaymentPlan(paymentPlanId);
  }

  createDisputeCase(input: {
    orderId: string;
    checkoutId?: string;
    actorInvolved: {
      actorId: string;
      actorType: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
      role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
    };
    type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
    description: string;
  }): DisputeCase {
    return this.sla.createDisputeCase(input);
  }

  async resolveDisputeCase(
    tenantId: string,
    disputeId: string,
    resolution: {
      resolutionType: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
      amountCents: number;
      currency?: string;
      resolvedBy: string;
      notes?: string;
    }
  ): Promise<DisputeCase> {
    return this.sla.resolveDisputeCase(tenantId, disputeId, resolution);
  }

  getDisputeCase(disputeId: string): DisputeCase | null {
    return this.sla.getDisputeCase(disputeId);
  }

  getDisputesByOrder(orderId: string): DisputeCase[] {
    return this.sla.getDisputesByOrder(orderId);
  }

  /** React to ServiceCompletedEvent: record order fulfilled for trust/SLA. */
  handleServiceCompleted(event: DomainEvent<ServiceCompletedPayload>): void {
    try {
      this.recordOrderEvent({
        orderId: event.payload.requestId,
        actorId: event.payload.providerId,
        actorType: 'service_provider',
        eventType: 'fulfilled',
      });
    } catch {
      // Ignore if SLA/orchestration not ready
    }
  }
}