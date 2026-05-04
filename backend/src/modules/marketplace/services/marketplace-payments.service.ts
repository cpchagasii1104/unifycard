// backend/src/modules/marketplace/services/marketplace-payments.service.ts
// Agregador: payment holds, completion signals, revenue snapshot, infra de pagamento e fluxo regional.
// Estado (stores/Maps) vive nos domain services (domain/payments); este agregador apenas delega.

import type {
  PaymentTerminal,
  ServicePaymentHold,
  PaymentInfrastructureConfig,
  RevenueSnapshot,
  RegionalFinancialFlow,
} from '@contracts/marketplace';
import type { PaymentsApplicationService } from '../application/services/payments-application.service';
import type { CommerceOperationsApplicationService } from '../application/services/commerce-operations-application.service';
import type { MarketplacePaymentsService as PaymentsDomainService } from '../domain/payments/marketplace-payments.service';
import type { DomainEvent } from '../core/event-bus';
import type { ServiceCompletedPayload } from '../core/events';

export interface IPaymentsDomainTerminalStore {
  getPaymentTerminal(id: string): PaymentTerminal | null;
  getPaymentTerminalsMap(): Map<string, PaymentTerminal>;
}

export class MarketplacePaymentsService {
  constructor(
    private readonly payments: PaymentsApplicationService,
    private readonly commerce: CommerceOperationsApplicationService,
    private readonly paymentsDomain: PaymentsDomainService
  ) {}

  releaseServicePaymentHoldPublic(holdId: string, releasedBy: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    return this.payments.releaseServicePaymentHoldPublic(holdId, releasedBy);
  }

  createServicePaymentHold(
    requestId: string,
    paymentPlanId: string,
    amountCents: number,
    currency: string,
    releasePolicy: 'client_confirm' | 'auto_after_deadline' | 'provider_confirm_with_proof' = 'client_confirm',
    releaseDeadlineHours: number = 24
  ): ServicePaymentHold {
    return this.paymentsDomain.createServicePaymentHold(
      requestId,
      paymentPlanId,
      amountCents,
      currency,
      releasePolicy,
      releaseDeadlineHours
    );
  }

  getServicePaymentHoldByRequest(requestId: string): ServicePaymentHold | null {
    return this.paymentsDomain.getServicePaymentHoldByRequest(requestId);
  }

  calculatePaymentDueDate(paymentTerms: string, baseDate: string): string {
    return this.paymentsDomain.calculatePaymentDueDate(paymentTerms, baseDate);
  }

  getServicePaymentHold(holdId: string): ServicePaymentHold | null {
    return this.paymentsDomain.getServicePaymentHold(holdId);
  }

  createServiceCompletionSignal(
    requestId: string,
    actorId: string,
    role: 'customer' | 'provider',
    action: 'confirm_completed' | 'dispute' | 'cancel',
    reason?: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'
  ) {
    return this.paymentsDomain.createServiceCompletionSignal(
      requestId,
      actorId,
      role,
      action,
      reason
    );
  }

  confirmServiceCompletedByCustomer(requestId: string, customerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    return this.payments.confirmServiceCompletedByCustomer(requestId, customerActorId);
  }

  confirmServiceCompletedByProvider(requestId: string, providerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    return this.payments.confirmServiceCompletedByProvider(requestId, providerActorId);
  }

  disputeService(
    requestId: string,
    actorId: string,
    role: 'customer' | 'provider',
    reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'
  ): { holdId: string; disputeCaseId: string; status: 'disputed' } {
    return this.payments.disputeService(requestId, actorId, role, reason);
  }

  expireServicePaymentHolds(): { expired_count: number; released_count: number } {
    return this.payments.expireServicePaymentHolds();
  }

  getPaymentTerminal(terminalId: string): PaymentTerminal | null {
    return this.paymentsDomain.getPaymentTerminal(terminalId);
  }

  getPaymentTerminalsMap(): Map<string, PaymentTerminal> {
    return this.paymentsDomain.getPaymentTerminalsMap();
  }

  getCompanyPaymentTerminals(companyId: string): PaymentTerminal[] {
    return Array.from(this.paymentsDomain.getPaymentTerminalsMap().values()).filter(
      (t) => t.companyId === companyId
    );
  }

  createPaymentInfrastructureConfig(input: {
    companyId: string;
    acceptUnificard: boolean;
    acceptExternalGateway: boolean;
    externalGatewayProvider?: string;
  }): PaymentInfrastructureConfig {
    return this.paymentsDomain.createPaymentInfrastructureConfig(input);
  }

  getPaymentInfrastructureConfig(companyId: string): PaymentInfrastructureConfig | null {
    return this.paymentsDomain.getPaymentInfrastructureConfigByCompanyId(companyId);
  }

  generateRevenueSnapshot(
    region: { country: string; state: string; city: string },
    period: { year: number; month: number }
  ): RevenueSnapshot {
    return this.paymentsDomain.generateRevenueSnapshot(region, period);
  }

  getRevenueSnapshot(
    region: { country: string; state: string; city: string },
    period: { year: number; month: number }
  ): RevenueSnapshot | null {
    return this.paymentsDomain.getRevenueSnapshotByRegionPeriod(region, period);
  }

  async getRegionalFinancialFlow(
    tenantId: string,
    region: { country: string; state: string; city: string },
    period: { year: number; month: number }
  ): Promise<RegionalFinancialFlow> {
    return this.commerce.getRegionalFinancialFlow(tenantId, region, period);
  }

  /** React to ServiceCompletedEvent: release payment hold when service visit is completed. */
  handleServiceCompleted(event: DomainEvent<ServiceCompletedPayload>): void {
    const hold = this.getServicePaymentHoldByRequest(event.payload.requestId);
    if (hold) {
      try {
        this.releaseServicePaymentHoldPublic(hold.holdId, 'service_completed');
      } catch {
        // Hold may already be released or business rules may prevent release; ignore
      }
    }
  }
}