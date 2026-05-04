// backend/src/modules/marketplace/services/marketplace-pricing.service.ts
// Agregador: apenas delega para o domain. Sem estado; estado (Maps) fica em domain/pricing.

import type { MarketplaceService } from '../marketplace.service';
import type {
  OperationalCostProfile,
  RealOperationMetrics,
  BreakEvenAnalysis,
  ServiceMarginAnalysis,
  PricingAssistanceReport,
} from '@contracts/marketplace';
import { MarketplacePricingDomainService } from '../domain/pricing/marketplace-pricing.service';

export class MarketplacePricingService {
  private readonly pricingDomain: MarketplacePricingDomainService;

  constructor(facade: MarketplaceService) {
    this.pricingDomain = new MarketplacePricingDomainService(facade);
  }

  getOperationalCostProfile(storeId: string): OperationalCostProfile | null {
    return this.pricingDomain.getOperationalCostProfile(storeId);
  }

  setOperationalCostProfileById(storeId: string, profile: OperationalCostProfile): void {
    return this.pricingDomain.setOperationalCostProfileById(storeId, profile);
  }

  getOperationalCostProfilesMap(): Map<string, OperationalCostProfile> {
    return this.pricingDomain.getOperationalCostProfilesMap();
  }

  calculateRealOperationMetrics(
    storeId: string,
    companyId: string,
    period: { start: string; end: string }
  ): RealOperationMetrics {
    return this.pricingDomain.calculateRealOperationMetrics(storeId, companyId, period);
  }

  calculateBreakEvenAnalysis(
    storeId: string,
    costProfile: OperationalCostProfile,
    operationMetrics: RealOperationMetrics
  ): BreakEvenAnalysis {
    return this.pricingDomain.calculateBreakEvenAnalysis(storeId, costProfile, operationMetrics);
  }

  calculateServiceMarginAnalysis(
    storeId: string,
    serviceOfferingId: string,
    costProfile: OperationalCostProfile,
    period: { start: string; end: string }
  ): ServiceMarginAnalysis | null {
    return this.pricingDomain.calculateServiceMarginAnalysis(storeId, serviceOfferingId, costProfile, period);
  }

  generatePricingAssistanceReport(
    storeId: string,
    companyId: string,
    actorId: string,
    period: { start: string; end: string }
  ): PricingAssistanceReport {
    return this.pricingDomain.generatePricingAssistanceReport(storeId, companyId, actorId, period);
  }

  getPricingAssistanceReport(reportId: string, actorId: string): PricingAssistanceReport | null {
    return this.pricingDomain.getPricingAssistanceReport(reportId, actorId);
  }

  listPricingAssistanceReports(filters: {
    storeId: string;
    actorId: string;
    starts_at?: string;
    ends_at?: string;
  }): PricingAssistanceReport[] {
    return this.pricingDomain.listPricingAssistanceReports(filters);
  }
}