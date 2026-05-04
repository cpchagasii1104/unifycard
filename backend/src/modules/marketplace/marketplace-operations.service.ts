// backend/src/modules/marketplace/marketplace.service.operations.ts
// Módulo Operations — service quotes, service visits, lifecycle e acesso aos mapas

import type { MarketplaceService } from './marketplace.service';
import type { ServiceQuote, ServiceVisit } from '@contracts/marketplace';
import { marketplaceLogger } from './marketplace.logger';

export class MarketplaceOperationsModule {
  private readonly serviceVisits: Map<string, ServiceVisit> = new Map();
  private readonly serviceQuotes: Map<string, ServiceQuote> = new Map();

  constructor(private readonly facade: MarketplaceService) {}

  getServiceVisitsMap(): Map<string, ServiceVisit> {
    return this.serviceVisits;
  }

  getServiceQuotesMap(): Map<string, ServiceQuote> {
    return this.serviceQuotes;
  }

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

    this.serviceVisits.set(visitId, visit);

    marketplaceLogger.init('ServiceVisit criada', {
      visitId,
      requestId: input.requestId,
      providerActorId: input.providerActorId,
    });

    return visit;
  }

  completeServiceVisit(visitId: string): ServiceVisit {
    const visit = this.serviceVisits.get(visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    if (visit.status !== 'visit_scheduled') {
      throw new Error(`Visita não está em status 'visit_scheduled' (status atual: ${visit.status})`);
    }

    visit.status = 'visit_completed';
    visit.completedAt = new Date().toISOString();
    this.serviceVisits.set(visitId, visit);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.facade.compliance.calculateServiceGovernanceMetrics(
      visit.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    marketplaceLogger.init('Visita marcada como completa', {
      visitId,
    });

    return visit;
  }

  getServiceVisitsByRequest(requestId: string): ServiceVisit[] {
    return Array.from(this.serviceVisits.values()).filter((v) => v.requestId === requestId);
  }

  getServiceVisit(visitId: string): ServiceVisit | null {
    return this.serviceVisits.get(visitId) ?? null;
  }

  getServiceQuotesByRequest(requestId: string): ServiceQuote[] {
    return Array.from(this.serviceQuotes.values()).filter((q) => q.requestId === requestId);
  }

  getServiceQuote(quoteId: string): ServiceQuote | null {
    return this.serviceQuotes.get(quoteId) ?? null;
  }
}