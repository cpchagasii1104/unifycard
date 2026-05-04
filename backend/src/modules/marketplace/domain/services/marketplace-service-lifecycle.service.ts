// backend/src/modules/marketplace/domain/services/marketplace-service-lifecycle.service.ts
// Single source of truth: service visits, quotes e métricas de governança por serviço.
// Estado (Maps) vive apenas aqui; facade e agregadores apenas delegam.

import type { MarketplaceService } from "../../marketplace.service";
import type { ServiceVisit, ServiceQuote, ServiceGovernanceMetrics } from "@contracts/marketplace";
import { domainEventBus } from "../../core/event-bus";
import { ServiceCompletedEvent } from "../../core/events";

export class MarketplaceServiceLifecycleService {

  private serviceVisits = new Map<string, ServiceVisit>();
  private serviceQuotes = new Map<string, ServiceQuote>();
  private serviceGovernanceMetrics = new Map<string, ServiceGovernanceMetrics>();

  constructor(private readonly facade: MarketplaceService) {}

  // Visits
  getServiceVisit(visitId: string): ServiceVisit | null {
    return this.serviceVisits.get(visitId) ?? null;
  }

  setServiceVisit(visitId: string, visit: ServiceVisit): void {
    this.serviceVisits.set(visitId, visit);
  }

  getServiceVisitsMap(): Map<string, ServiceVisit> {
    return this.serviceVisits;
  }

  // Quotes
  getServiceQuote(quoteId: string): ServiceQuote | null {
    return this.serviceQuotes.get(quoteId) ?? null;
  }

  setServiceQuote(quoteId: string, quote: ServiceQuote): void {
    this.serviceQuotes.set(quoteId, quote);
  }

  getServiceQuotesMap(): Map<string, ServiceQuote> {
    return this.serviceQuotes;
  }

  // Governance metrics
  getServiceGovernanceMetrics(serviceId: string): ServiceGovernanceMetrics | null {
    return this.serviceGovernanceMetrics.get(serviceId) ?? null;
  }

  setServiceGovernanceMetrics(serviceId: string, metrics: ServiceGovernanceMetrics): void {
    this.serviceGovernanceMetrics.set(serviceId, metrics);
  }

  getServiceGovernanceMetricsMap(): Map<string, ServiceGovernanceMetrics> {
    return this.serviceGovernanceMetrics;
  }

  // --- Lógica de negócio (visits) ---

  createServiceVisit(input: {
    requestId: string;
    dispatchId: string;
    providerActorId: string;
    scheduledDate: string;
    scheduledTime: string;
  }): ServiceVisit {
    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const visit: ServiceVisit = {
      visitId,
      requestId: input.requestId,
      dispatchId: input.dispatchId,
      providerActorId: input.providerActorId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      status: 'visit_scheduled',
      createdAt: new Date().toISOString(),
    };
    this.setServiceVisit(visitId, visit);
    return visit;
  }

  completeServiceVisit(visitId: string): ServiceVisit {
    const visit = this.getServiceVisit(visitId);
    if (!visit) throw new Error('Visita não encontrada');
    if (visit.status !== 'visit_scheduled') {
      throw new Error(`Visita não está em status 'visit_scheduled' (status atual: ${visit.status})`);
    }
    visit.status = 'visit_completed';
    visit.completedAt = new Date().toISOString();
    this.setServiceVisit(visitId, visit);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.facade.compliance.calculateServiceGovernanceMetrics(
      visit.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );
    domainEventBus.publish(
      new ServiceCompletedEvent({
        providerId: visit.providerActorId,
        requestId: visit.requestId,
        visitId,
      })
    );
    return visit;
  }

  getServiceVisitsByRequest(requestId: string): ServiceVisit[] {
    return Array.from(this.serviceVisits.values()).filter(v => v.requestId === requestId);
  }

  getServiceQuotesByRequest(requestId: string): ServiceQuote[] {
    return Array.from(this.serviceQuotes.values()).filter(q => q.requestId === requestId);
  }
}