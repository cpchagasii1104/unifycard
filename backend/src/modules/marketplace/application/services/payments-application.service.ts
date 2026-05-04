// backend/src/modules/marketplace/application/services/payments-application.service.ts
// Application Service: payment infrastructure, service payment holds, revenue snapshots.

import type {
  PaymentInfrastructureConfig,
  ServicePaymentHold,
  ServiceCompletionSignal,
  ServiceRequest,
  ServiceDispatch,
  PaymentPlan,
  RevenueSnapshot,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

export interface IPaymentInfrastructureConfigStore {
  get(id: string): PaymentInfrastructureConfig | undefined;
  set(id: string, value: PaymentInfrastructureConfig): void;
  getMap(): Map<string, PaymentInfrastructureConfig>;
}

export interface IServicePaymentHoldStore {
  get(id: string): ServicePaymentHold | undefined;
  set(id: string, value: ServicePaymentHold): void;
  getMap(): Map<string, ServicePaymentHold>;
}

export interface IServiceCompletionSignalStore {
  get(id: string): ServiceCompletionSignal | undefined;
  set(id: string, value: ServiceCompletionSignal): void;
  getMap(): Map<string, ServiceCompletionSignal>;
}

export interface IRevenueSnapshotStore {
  get(id: string): RevenueSnapshot | undefined;
  set(id: string, value: RevenueSnapshot): void;
  getMap(): Map<string, RevenueSnapshot>;
}

export interface IPaymentsOrchestrator {
  getServiceRequest(requestId: string): ServiceRequest | null;
  getServiceDispatchesMap(): Map<string, ServiceDispatch>;
  setServiceRequest(requestId: string, request: ServiceRequest): void;
  getPaymentPlan(paymentPlanId: string): PaymentPlan | null;
  createDisputeCase?(payload: {
    orderId: string;
    actorInvolved: string[];
    type: string;
    status: string;
  }): { dispute_id: string };
}

export interface IPaymentsApplicationDeps {
  paymentInfrastructureConfigStore: IPaymentInfrastructureConfigStore;
  servicePaymentHoldStore: IServicePaymentHoldStore;
  serviceCompletionSignalStore: IServiceCompletionSignalStore;
  revenueSnapshotStore: IRevenueSnapshotStore;
  orchestrator: IPaymentsOrchestrator;
}

export class PaymentsApplicationService {
  constructor(private readonly deps: IPaymentsApplicationDeps) {}

  createPaymentInfrastructureConfig(input: {
    companyId: string;
    acceptUnificard: boolean;
    acceptExternalGateway: boolean;
    externalGatewayProvider?: string;
  }): PaymentInfrastructureConfig {
    const configId = `payment-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const feeStructure = {
      transactionRate: input.acceptUnificard ? 2.5 : 3.0,
      regionalFundPercentage: 0.5,
      platformPercentage: 1.0,
      infrastructurePercentage: 0.3,
      referralPercentage: 0.2,
    };

    const config: PaymentInfrastructureConfig = {
      configId,
      companyId: input.companyId,
      acceptUnificard: input.acceptUnificard,
      acceptExternalGateway: input.acceptExternalGateway,
      externalGatewayProvider: input.externalGatewayProvider,
      feeStructure,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.deps.paymentInfrastructureConfigStore.set(configId, config);

    marketplaceLogger.init('Configuração de infraestrutura de pagamento criada', {
      configId,
      companyId: input.companyId,
    });

    return config;
  }

  getPaymentInfrastructureConfig(companyId: string): PaymentInfrastructureConfig | null {
    return Array.from(this.deps.paymentInfrastructureConfigStore.getMap().values()).find(c => c.companyId === companyId) || null;
  }

  createServicePaymentHold(
    requestId: string,
    paymentPlanId: string,
    amountCents: number,
    currency: string,
    releasePolicy: 'client_confirm' | 'auto_after_deadline' | 'provider_confirm_with_proof' = 'client_confirm',
    releaseDeadlineHours: number = 24
  ): ServicePaymentHold {
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + releaseDeadlineHours * 60 * 60 * 1000);

    const hold: ServicePaymentHold = {
      holdId,
      requestId,
      paymentPlanId,
      amountCents,
      currency,
      status: 'held',
      createdAt: now.toISOString(),
      releaseDeadlineAt: deadline.toISOString(),
      releasePolicy,
    };

    this.deps.servicePaymentHoldStore.set(holdId, hold);

    marketplaceLogger.init('Payment hold criado para serviço', {
      holdId,
      requestId,
      paymentPlanId,
      amountCents,
      releasePolicy,
    });

    return hold;
  }

  getServicePaymentHoldByRequest(requestId: string): ServicePaymentHold | null {
    const hold = Array.from(this.deps.servicePaymentHoldStore.getMap().values())
      .find(h => h.requestId === requestId && h.status === 'held');
    return hold || null;
  }

  getServicePaymentHold(holdId: string): ServicePaymentHold | null {
    return this.deps.servicePaymentHoldStore.get(holdId) || null;
  }

  createServiceCompletionSignal(
    requestId: string,
    actorId: string,
    role: 'customer' | 'provider',
    action: 'confirm_completed' | 'dispute' | 'cancel',
    reason?: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'
  ): ServiceCompletionSignal {
    const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const signal: ServiceCompletionSignal = {
      signalId,
      requestId,
      actorId,
      role,
      action,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.deps.serviceCompletionSignalStore.set(signalId, signal);

    marketplaceLogger.init('Sinal de conclusão criado', {
      signalId,
      requestId,
      actorId,
      role,
      action,
    });

    return signal;
  }

  confirmServiceCompletedByCustomer(requestId: string, customerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.deps.orchestrator.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode confirmar');
    }

    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    this.createServiceCompletionSignal(requestId, customerActorId, 'customer', 'confirm_completed');

    return this.releaseServicePaymentHold(hold.holdId, customerActorId);
  }

  confirmServiceCompletedByProvider(requestId: string, providerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.deps.orchestrator.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const acceptedDispatch = Array.from(this.deps.orchestrator.getServiceDispatchesMap().values())
      .find(d => d.requestId === requestId && d.status === 'accepted');

    if (!acceptedDispatch || acceptedDispatch.acceptedBy !== providerActorId) {
      throw new Error('Apenas o provider que aceitou o serviço pode confirmar');
    }

    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    this.createServiceCompletionSignal(requestId, providerActorId, 'provider', 'confirm_completed');

    if (hold.releasePolicy === 'provider_confirm_with_proof') {
      return this.releaseServicePaymentHold(hold.holdId, providerActorId);
    }

    throw new Error('Provider não pode liberar pagamento diretamente nesta política');
  }

  disputeService(requestId: string, actorId: string, role: 'customer' | 'provider', reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'): {
    holdId: string;
    disputeCaseId: string;
    status: 'disputed';
  } {
    const request = this.deps.orchestrator.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (role === 'customer' && request.requesterActorId !== actorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode disputar');
    }

    let acceptedDispatch: { acceptedBy: string } | undefined;
    if (role === 'provider') {
      const found = Array.from(this.deps.orchestrator.getServiceDispatchesMap().values())
        .find(d => d.requestId === requestId && d.status === 'accepted');
      if (!found || found.acceptedBy !== actorId) {
        throw new Error('Apenas o provider que aceitou o serviço pode disputar');
      }
      acceptedDispatch = { acceptedBy: found.acceptedBy };
    }

    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    this.createServiceCompletionSignal(requestId, actorId, role, 'dispute', reason);

    let disputeCaseId: string;
    try {
      if (this.deps.orchestrator.createDisputeCase) {
        const disputeCase = this.deps.orchestrator.createDisputeCase({
          orderId: requestId,
          actorInvolved: [request.requesterActorId, acceptedDispatch?.acceptedBy].filter(Boolean) as string[],
          type: 'service_dispute',
          status: 'open',
        });
        disputeCaseId = disputeCase.dispute_id;
      } else {
        disputeCaseId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    } catch {
      disputeCaseId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    hold.status = 'disputed';
    hold.disputeCaseId = disputeCaseId;
    this.deps.servicePaymentHoldStore.set(hold.holdId, hold);

    marketplaceLogger.init('Payment hold marcado como disputado', {
      holdId: hold.holdId,
      requestId,
      disputeCaseId,
    });

    return {
      holdId: hold.holdId,
      disputeCaseId,
      status: 'disputed',
    };
  }

  expireServicePaymentHolds(): {
    expired_count: number;
    released_count: number;
  } {
    const now = new Date();
    let expiredCount = 0;
    let releasedCount = 0;

    for (const hold of this.deps.servicePaymentHoldStore.getMap().values()) {
      if (hold.status === 'held' && new Date(hold.releaseDeadlineAt) <= now) {
        const hasDispute = Array.from(this.deps.serviceCompletionSignalStore.getMap().values())
          .some(s => s.requestId === hold.requestId && s.action === 'dispute');

        if (!hasDispute) {
          try {
            this.releaseServicePaymentHold(hold.holdId, 'auto');
            releasedCount++;
          } catch {
            hold.status = 'expired';
            this.deps.servicePaymentHoldStore.set(hold.holdId, hold);
            expiredCount++;
          }
        } else {
          hold.status = 'expired';
          this.deps.servicePaymentHoldStore.set(hold.holdId, hold);
          expiredCount++;
        }
      }
    }

    return { expired_count: expiredCount, released_count: releasedCount };
  }

  /** TEMP compatibility layer (post-refactor): release a service payment hold. */
  releaseServicePaymentHoldPublic(holdId: string, releasedBy: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    return this.releaseServicePaymentHold(holdId, releasedBy);
  }

  private releaseServicePaymentHold(holdId: string, releasedBy: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const hold = this.deps.servicePaymentHoldStore.get(holdId);
    if (!hold) {
      throw new Error('Payment hold não encontrado');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    const paymentPlan = this.deps.orchestrator.getPaymentPlan(hold.paymentPlanId);
    if (!paymentPlan) {
      throw new Error('PaymentPlan não encontrado');
    }

    if (paymentPlan.status === 'executed') {
      const releasedAt = new Date().toISOString();
      hold.status = 'released';
      hold.releasedAt = releasedAt;
      hold.releasedBy = releasedBy;
      this.deps.servicePaymentHoldStore.set(holdId, hold);

      marketplaceLogger.init('Payment hold liberado', {
        holdId,
        paymentPlanId: hold.paymentPlanId,
        releasedBy,
      });

      return {
        holdId,
        releasedAt,
        status: 'released',
      };
    }

    throw new Error('PaymentPlan não foi executado ainda');
  }

  generateRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot {
    const existingSnapshot = Array.from(this.deps.revenueSnapshotStore.getMap().values()).find(
      s =>
        s.region.country === region.country &&
        s.region.state === region.state &&
        s.region.city === region.city &&
        s.period.year === period.year &&
        s.period.month === period.month
    );

    if (existingSnapshot) {
      throw new Error(
        `Snapshot de receita já existe para ${region.city}/${region.state} - ${period.month}/${period.year}. ` +
        `Snapshots são imutáveis.`
      );
    }

    const snapshotId = `revenue-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const snapshot: RevenueSnapshot = {
      snapshotId,
      region,
      period,
      revenues: {
        transaction: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        b2b: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        subscription: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        terminal: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        logistics: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
      },
      totalTransactedCents: 0,
      totalFeesCents: 0,
      totalPlatformRevenueCents: 0,
      totalRegionalFundRevenueCents: 0,
      totalInfrastructureCostCents: 0,
      totalIncentivesCents: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString(),
    };

    this.deps.revenueSnapshotStore.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de receita mensal gerado', {
      snapshotId,
      region: `${region.city}, ${region.state}`,
      period: `${period.month}/${period.year}`,
    });

    return snapshot;
  }

  getRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot | null {
    return (
      Array.from(this.deps.revenueSnapshotStore.getMap().values()).find(
        s =>
          s.region.country === region.country &&
          s.region.state === region.state &&
          s.region.city === region.city &&
          s.period.year === period.year &&
          s.period.month === period.month
      ) || null
    );
  }
}