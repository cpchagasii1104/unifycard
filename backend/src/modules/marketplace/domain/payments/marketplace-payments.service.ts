// backend/src/modules/marketplace/domain/payments/marketplace-payments.service.ts
// Single source of truth: terminais, configs de infra, revenue snapshots, holds, completion signals.
// Estado (Maps) vive apenas aqui; facade e agregadores apenas delegam.

import type { MarketplaceService } from "../../marketplace.service";
import type {
  PaymentTerminal,
  PaymentInfrastructureConfig,
  RevenueSnapshot,
  ServicePaymentHold,
  ServiceCompletionSignal,
} from "@contracts/marketplace";
import { marketplaceLogger } from "../../marketplace.logger";
import { domainEventBus } from "../../core/event-bus";
import { PaymentHoldCreatedEvent } from "../../core/events";

export class MarketplacePaymentsService {

  private paymentTerminals = new Map<string, PaymentTerminal>();
  private paymentInfrastructureConfigs = new Map<string, PaymentInfrastructureConfig>();
  private revenueSnapshots = new Map<string, RevenueSnapshot>();
  private servicePaymentHolds = new Map<string, ServicePaymentHold>();
  private serviceCompletionSignals = new Map<string, ServiceCompletionSignal>();

  constructor(private readonly facade: MarketplaceService) {}

  // Payment terminals
  getPaymentTerminal(id: string): PaymentTerminal | null {
    return this.paymentTerminals.get(id) ?? null;
  }

  setPaymentTerminal(id: string, terminal: PaymentTerminal): void {
    this.paymentTerminals.set(id, terminal);
  }

  getPaymentTerminalsMap(): Map<string, PaymentTerminal> {
    return this.paymentTerminals;
  }

  // Infrastructure config
  getPaymentInfrastructureConfig(id: string): PaymentInfrastructureConfig | null {
    return this.paymentInfrastructureConfigs.get(id) ?? null;
  }

  setPaymentInfrastructureConfig(id: string, config: PaymentInfrastructureConfig): void {
    this.paymentInfrastructureConfigs.set(id, config);
  }

  getPaymentInfrastructureConfigsMap(): Map<string, PaymentInfrastructureConfig> {
    return this.paymentInfrastructureConfigs;
  }

  // Revenue snapshots
  getRevenueSnapshot(id: string): RevenueSnapshot | null {
    return this.revenueSnapshots.get(id) ?? null;
  }

  setRevenueSnapshot(id: string, snapshot: RevenueSnapshot): void {
    this.revenueSnapshots.set(id, snapshot);
  }

  getRevenueSnapshotsMap(): Map<string, RevenueSnapshot> {
    return this.revenueSnapshots;
  }

  // Payment holds
  getServicePaymentHold(id: string): ServicePaymentHold | null {
    return this.servicePaymentHolds.get(id) ?? null;
  }

  setServicePaymentHold(id: string, hold: ServicePaymentHold): void {
    this.servicePaymentHolds.set(id, hold);
  }

  getServicePaymentHoldsMap(): Map<string, ServicePaymentHold> {
    return this.servicePaymentHolds;
  }

  // Completion signals
  getServiceCompletionSignal(id: string): ServiceCompletionSignal | null {
    return this.serviceCompletionSignals.get(id) ?? null;
  }

  setServiceCompletionSignal(id: string, signal: ServiceCompletionSignal): void {
    this.serviceCompletionSignals.set(id, signal);
  }

  getServiceCompletionSignalsMap(): Map<string, ServiceCompletionSignal> {
    return this.serviceCompletionSignals;
  }

  // --- Lógica de negócio (config, hold, signal, snapshot) ---

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
    this.setPaymentInfrastructureConfig(configId, config);
    marketplaceLogger.init('Configuração de infraestrutura de pagamento criada', { configId, companyId: input.companyId });
    return config;
  }

  getPaymentInfrastructureConfigByCompanyId(companyId: string): PaymentInfrastructureConfig | null {
    const found = Array.from(this.paymentInfrastructureConfigs.values()).find(c => c.companyId === companyId);
    return found ?? null;
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
    this.setServicePaymentHold(holdId, hold);
    marketplaceLogger.init('Payment hold criado para serviço', { holdId, requestId, paymentPlanId, amountCents, releasePolicy });
    domainEventBus.publish(new PaymentHoldCreatedEvent({ holdId, requestId }));
    return hold;
  }

  getServicePaymentHoldByRequest(requestId: string): ServicePaymentHold | null {
    const hold = Array.from(this.servicePaymentHolds.values())
      .find(h => h.requestId === requestId && h.status === 'held');
    return hold ?? null;
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
    this.setServiceCompletionSignal(signalId, signal);
    marketplaceLogger.init('Sinal de conclusão criado', { signalId, requestId, actorId, role, action });
    return signal;
  }

  generateRevenueSnapshot(region: { country: string; state: string; city: string }, period: { year: number; month: number }): RevenueSnapshot {
    const existing = this.getRevenueSnapshotByRegionPeriod(region, period);
    if (existing) {
      throw new Error(
        `Snapshot de receita já existe para ${region.city}/${region.state} - ${period.month}/${period.year}. Snapshots são imutáveis.`
      );
    }
    const snapshotId = `revenue-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snapshot: RevenueSnapshot = {
      snapshotId,
      region,
      period,
      revenues: {
        transaction: { totalAmountCents: 0, platformRevenueCents: 0, regionalFundRevenueCents: 0, infrastructureCostCents: 0 },
        b2b: { totalAmountCents: 0, platformRevenueCents: 0, regionalFundRevenueCents: 0 },
        subscription: { totalAmountCents: 0, platformRevenueCents: 0, regionalFundRevenueCents: 0 },
        terminal: { totalAmountCents: 0, platformRevenueCents: 0, regionalFundRevenueCents: 0, infrastructureCostCents: 0 },
        logistics: { totalAmountCents: 0, platformRevenueCents: 0, regionalFundRevenueCents: 0 },
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
    this.setRevenueSnapshot(snapshotId, snapshot);
    marketplaceLogger.init('Snapshot de receita mensal gerado', { snapshotId, region: `${region.city}, ${region.state}`, period: `${period.month}/${period.year}` });
    return snapshot;
  }

  getRevenueSnapshotByRegionPeriod(region: { country: string; state: string; city: string }, period: { year: number; month: number }): RevenueSnapshot | null {
    const found = Array.from(this.revenueSnapshots.values()).find(
      s =>
        s.region.country === region.country &&
        s.region.state === region.state &&
        s.region.city === region.city &&
        s.period.year === period.year &&
        s.period.month === period.month
    );
    return found ?? null;
  }

  /**
   * Calcular data de vencimento baseado em payment_terms (regra de domínio).
   */
  calculatePaymentDueDate(paymentTerms: string, baseDate: string): string {
    const base = new Date(baseDate);
    let days = 0;
    switch (paymentTerms) {
      case 'prepaid':
        days = 0;
        break;
      case 'net_15':
        days = 15;
        break;
      case 'net_30':
        days = 30;
        break;
      case 'net_60':
        days = 60;
        break;
      default:
        days = 30;
    }
    const dueDate = new Date(base);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate.toISOString();
  }
}