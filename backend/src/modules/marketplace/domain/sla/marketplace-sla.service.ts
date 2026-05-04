// backend/src/modules/marketplace/marketplace.service.sla.ts
// Módulo SLA: contratos de SLA, reputação, eventos de pedido, disputas

import type { MarketplaceService } from '../../marketplace.service';
import { marketplaceLogger } from '../../marketplace.logger';
import type { SLAContract, ReputationSnapshot, DisputeCase, PaymentPlan } from '@contracts/marketplace';

export type OrderEventEntry = {
  orderId: string;
  actorId: string;
  actorType: string;
  eventType: string;
  timestamp: string;
  fulfillmentTimeHours?: number;
};

export class MarketplaceSlaModule {
  private readonly slaContracts: Map<string, SLAContract> = new Map();
  private readonly reputationSnapshots: Map<string, ReputationSnapshot[]> = new Map();
  private readonly disputeCases: Map<string, DisputeCase> = new Map();
  private readonly orderEvents: Map<string, OrderEventEntry[]> = new Map();

  constructor(private readonly facade: MarketplaceService) {}

  createSLAContract(input: {
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    actorId: string;
    metrics: {
      fulfillmentTime: { targetHours: number; maxHours: number };
      cancellationRate: { targetPercentage: number; maxPercentage: number };
      disputeRate: { targetPercentage: number; maxPercentage: number };
    };
    thresholds: {
      warning: {
        fulfillmentTimeHours: number;
        cancellationRatePercentage: number;
        disputeRatePercentage: number;
      };
      violation: {
        fulfillmentTimeHours: number;
        cancellationRatePercentage: number;
        disputeRatePercentage: number;
      };
    };
    penalties: {
      fulfillmentTimeViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      cancellationRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      disputeRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
    };
  }): SLAContract {
    const slaId = `sla-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sla: SLAContract = {
      slaId: slaId,
      actorType: input.actorType,
      actorId: input.actorId,
      metrics: {
        fulfillmentTime: { ...input.metrics.fulfillmentTime, unit: 'hours' },
        cancellationRate: { ...input.metrics.cancellationRate, unit: 'percentage' },
        disputeRate: { ...input.metrics.disputeRate, unit: 'percentage' },
      },
      thresholds: input.thresholds,
      penalties: input.penalties,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.slaContracts.set(slaId, sla);
    marketplaceLogger.init('SLA contract criado', { slaId: slaId, actorId: input.actorId });
    return sla;
  }

  getSLAContract(slaId: string): SLAContract | null {
    return this.slaContracts.get(slaId) || null;
  }

  getSLAContractByActor(actorId: string, actorType: 'store' | 'hub' | 'industry' | 'service_provider'): SLAContract | null {
    for (const sla of this.slaContracts.values()) {
      if (sla.actorId === actorId && sla.actorType === actorType && sla.isActive) {
        return sla;
      }
    }
    return null;
  }

  recordOrderEvent(input: {
    orderId: string;
    actorId: string;
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    eventType: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    fulfillmentTimeHours?: number;
  }): void {
    const events = this.orderEvents.get(input.actorId) || [];
    events.push({
      ...input,
      timestamp: new Date().toISOString(),
    });
    this.orderEvents.set(input.actorId, events);
    marketplaceLogger.init('Order event registrado', { actorId: input.actorId, eventType: input.eventType });
  }

  generateReputationSnapshot(
    actorId: string,
    actorType: 'store' | 'hub' | 'industry' | 'service_provider',
    year: number,
    month: number
  ): ReputationSnapshot {
    const existingSnapshots = this.reputationSnapshots.get(actorId) || [];
    const existing = existingSnapshots.find((s) => s.period.year === year && s.period.month === month);
    if (existing) {
      throw new Error(`Snapshot já existe para ${year}-${month}. Snapshots são imutáveis.`);
    }

    const events = this.orderEvents.get(actorId) || [];
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);
    const periodEvents = events.filter((e) => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= periodStart && eventDate <= periodEnd;
    });

    const totalOrders = periodEvents.filter((e) => e.eventType === 'created').length;
    const fulfilledOrders = periodEvents.filter((e) => e.eventType === 'fulfilled' || e.eventType === 'delivered').length;
    const cancelledOrders = periodEvents.filter((e) => e.eventType === 'cancelled').length;
    const disputedOrders = periodEvents.filter((e) => e.eventType === 'disputed').length;

    const fulfillmentTimes = periodEvents
      .filter((e) => e.fulfillmentTimeHours !== undefined)
      .map((e) => e.fulfillmentTimeHours!);
    const averageFulfillmentTime = fulfillmentTimes.length > 0 ? fulfillmentTimes.reduce((sum, t) => sum + t, 0) / fulfillmentTimes.length : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const disputeRate = totalOrders > 0 ? (disputedOrders / totalOrders) * 100 : 0;

    const sla = this.getSLAContractByActor(actorId, actorType);
    const onTimeDeliveries = periodEvents.filter((e) => {
      if (e.eventType !== 'delivered' || !e.fulfillmentTimeHours) return false;
      if (!sla) return false;
      return e.fulfillmentTimeHours <= sla.metrics.fulfillmentTime.targetHours;
    }).length;
    const onTimeDeliveryPercentage = fulfilledOrders > 0 ? (onTimeDeliveries / fulfilledOrders) * 100 : 0;

    const baseScore = 100;
    let fulfillmentPenalty = 0;
    let cancellationPenalty = 0;
    let disputePenalty = 0;
    if (sla) {
      if (averageFulfillmentTime > sla.metrics.fulfillmentTime.targetHours) {
        const excessHours = averageFulfillmentTime - sla.metrics.fulfillmentTime.targetHours;
        fulfillmentPenalty = Math.min(excessHours * 2, 30);
      }
      if (cancellationRate > sla.metrics.cancellationRate.targetPercentage) {
        const excessRate = cancellationRate - sla.metrics.cancellationRate.targetPercentage;
        cancellationPenalty = Math.min(excessRate * 5, 30);
      }
      if (disputeRate > sla.metrics.disputeRate.targetPercentage) {
        const excessRate = disputeRate - sla.metrics.disputeRate.targetPercentage;
        disputePenalty = Math.min(excessRate * 10, 40);
      }
    }
    const finalScore = Math.max(0, baseScore - fulfillmentPenalty - cancellationPenalty - disputePenalty);

    const getSLAStatus = (value: number, warning: number, violation: number): 'compliant' | 'warning' | 'violation' => {
      if (value <= warning) return 'compliant';
      if (value <= violation) return 'warning';
      return 'violation';
    };

    const fulfillmentTimeStatus = sla
      ? getSLAStatus(averageFulfillmentTime, sla.thresholds.warning.fulfillmentTimeHours, sla.thresholds.violation.fulfillmentTimeHours)
      : 'compliant';
    const cancellationRateStatus = sla
      ? getSLAStatus(cancellationRate, sla.thresholds.warning.cancellationRatePercentage, sla.thresholds.violation.cancellationRatePercentage)
      : 'compliant';
    const disputeRateStatus = sla
      ? getSLAStatus(disputeRate, sla.thresholds.warning.disputeRatePercentage, sla.thresholds.violation.disputeRatePercentage)
      : 'compliant';
    const overallStatus: 'compliant' | 'warning' | 'violation' =
      fulfillmentTimeStatus === 'violation' || cancellationRateStatus === 'violation' || disputeRateStatus === 'violation'
        ? 'violation'
        : fulfillmentTimeStatus === 'warning' || cancellationRateStatus === 'warning' || disputeRateStatus === 'warning'
          ? 'warning'
          : 'compliant';

    const snapshot: ReputationSnapshot = {
      snapshotId: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actorId: actorId,
      actorType: actorType,
      period: { year, month },
      metrics: {
        totalOrders,
        fulfilledOrders,
        cancelledOrders,
        disputedOrders,
        averageFulfillmentTimeHours: averageFulfillmentTime,
        cancellationRatePercentage: cancellationRate,
        disputeRatePercentage: disputeRate,
        onTimeDeliveryPercentage: onTimeDeliveryPercentage,
      },
      score: {
        baseScore: baseScore,
        fulfillmentPenalty,
        cancellationPenalty,
        disputePenalty,
        finalScore: finalScore,
      },
      slaStatus: {
        fulfillmentTime: fulfillmentTimeStatus,
        cancellationRate: cancellationRateStatus,
        disputeRate: disputeRateStatus,
        overall: overallStatus,
      },
      createdAt: new Date().toISOString(),
    };

    existingSnapshots.push(snapshot);
    this.reputationSnapshots.set(actorId, existingSnapshots);
    marketplaceLogger.init('Reputation snapshot gerado', { snapshotId: snapshot.snapshotId, actorId: actorId, period: `${year}-${month}` });
    return snapshot;
  }

  getReputationSnapshots(actorId: string): ReputationSnapshot[] {
    return this.reputationSnapshots.get(actorId) || [];
  }

  getReputationSnapshot(snapshotId: string): ReputationSnapshot | null {
    for (const snapshots of this.reputationSnapshots.values()) {
      const snapshot = snapshots.find((s) => s.snapshotId === snapshotId);
      if (snapshot) return snapshot;
    }
    return null;
  }

  applySLAPenaltiesToPaymentPlan(paymentPlanId: string): PaymentPlan {
    const paymentPlan = this.facade.orders.getOrders().getPaymentPlan(paymentPlanId);
    if (!paymentPlan) {
      throw new Error('Payment plan não encontrado');
    }
    const checkout = this.facade.checkout.getCheckout(paymentPlan.checkoutId);
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    const actorSlas = new Map<string, SLAContract>();
    for (const order of checkout.orders) {
      const storeSLA = this.getSLAContractByActor(order.storeId, 'store');
      if (storeSLA) {
        actorSlas.set(`store-${order.storeId}`, storeSLA);
      }
      const storeSnapshots = this.getReputationSnapshots(order.storeId);
      const latestSnapshot = storeSnapshots[storeSnapshots.length - 1];

      if (latestSnapshot && latestSnapshot.slaStatus.overall === 'violation') {
        const sla = actorSlas.get(`store-${order.storeId}`);
        if (sla) {
          const sellerSplit = paymentPlan.splits.find((s) => s.type === 'seller' && s.targetId === order.storeId);
          if (sellerSplit && sellerSplit.amountCents > 0) {
            let penaltyAmount = 0;
            if (latestSnapshot.slaStatus.fulfillmentTime === 'violation') {
              if (sla.penalties.fulfillmentTimeViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.fulfillmentTimeViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.fulfillmentTimeViolation.valueCents;
              }
            }
            if (latestSnapshot.slaStatus.cancellationRate === 'violation') {
              if (sla.penalties.cancellationRateViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.cancellationRateViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.cancellationRateViolation.valueCents;
              }
            }
            if (latestSnapshot.slaStatus.disputeRate === 'violation') {
              if (sla.penalties.disputeRateViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.disputeRateViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.disputeRateViolation.valueCents;
              }
            }
            penaltyAmount = Math.min(penaltyAmount, sellerSplit.amountCents);
            if (penaltyAmount > 0) {
              (paymentPlan as unknown as Record<string, unknown>).pending_penalties = (paymentPlan as unknown as Record<string, unknown>).pending_penalties || [];
              (paymentPlan as unknown as Record<string, unknown>).pending_penalties = [
                ...((paymentPlan as unknown as Record<string, unknown>).pending_penalties as Array<unknown>),
                {
                  storeId: order.storeId,
                  penalty_amount: penaltyAmount,
                  redirect_to: sla.penalties.fulfillmentTimeViolation.redirectTo,
                  sla_violations: {
                    fulfillmentTime: latestSnapshot.slaStatus.fulfillmentTime === 'violation',
                    cancellationRate: latestSnapshot.slaStatus.cancellationRate === 'violation',
                    disputeRate: latestSnapshot.slaStatus.disputeRate === 'violation',
                  },
                },
              ];
            }
          }
        }
      }
    }
    (paymentPlan as unknown as Record<string, unknown>).sla_penalties_applied = true;
    marketplaceLogger.init('SLA penalties aplicadas ao payment plan', { paymentPlanId });
    return paymentPlan;
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
    const disputeId = `dispute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dispute: DisputeCase = {
      disputeId: disputeId,
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      actorInvolved: input.actorInvolved,
      type: input.type,
      status: 'open',
      description: input.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.disputeCases.set(disputeId, dispute);
    this.recordOrderEvent({
      orderId: input.orderId,
      actorId: input.actorInvolved.actorId,
      actorType: input.actorInvolved.actorType === 'customer' ? 'store' : input.actorInvolved.actorType,
      eventType: 'disputed',
    });
    marketplaceLogger.init('Dispute case criado', { disputeId: disputeId });
    return dispute;
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
    const dispute = this.disputeCases.get(disputeId);
    if (!dispute) throw new Error('Dispute case não encontrado');
    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new Error('Dispute case já foi resolvido ou rejeitado');
    }
    dispute.status = 'resolved';
    dispute.resolution = {
      resolutionType: resolution.resolutionType,
      amountCents: resolution.amountCents,
      currency: resolution.currency,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date().toISOString(),
      notes: resolution.notes,
    };
    dispute.updatedAt = new Date().toISOString();
    this.disputeCases.set(disputeId, dispute);
    marketplaceLogger.init('Dispute case resolvido', { disputeId: disputeId });
    return dispute;
  }

  getDisputeCase(disputeId: string): DisputeCase | null {
    return this.disputeCases.get(disputeId) || null;
  }

  getDisputesByOrder(orderId: string): DisputeCase[] {
    return Array.from(this.disputeCases.values()).filter((d) => d.orderId === orderId);
  }

  getDisputeCasesMap(): Map<string, DisputeCase> {
    return this.disputeCases;
  }

  getOrderEvents(actorId: string): OrderEventEntry[] {
    return this.orderEvents.get(actorId) || [];
  }

  setOrderEvents(actorId: string, events: OrderEventEntry[]): void {
    this.orderEvents.set(actorId, events);
  }
}