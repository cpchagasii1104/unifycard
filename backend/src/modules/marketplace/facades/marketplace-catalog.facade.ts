// backend/src/modules/marketplace/facades/marketplace-catalog.facade.ts
// Cluster 1 — Catálogo, home, lojas, produtos, offerings, service booking, seed.
// Commit 25: extraído da MarketplaceService para reduzir a facade principal.

import type { MarketplaceCatalogAggregatorService } from '../services/marketplace-catalog.service';
import type { MarketplaceOrchestrationService } from '../application/services/marketplace-orchestration.service';
import type { CatalogApplicationService } from '../application/services/catalog-application.service';
import type { OfferingsApplicationService } from '../application/services/offerings-application.service';

export interface IMarketplaceCatalogFacadeDeps {
  getOrchestration(): MarketplaceOrchestrationService;
  getCatalog(): MarketplaceCatalogAggregatorService;
  getCatalogApplicationService(): CatalogApplicationService;
  getOfferingsApplicationService(): OfferingsApplicationService;
  getDispatchPresence(): { setProviderOnlineStatus(id: string, online: boolean): void };
}

export class MarketplaceCatalogFacade {
  constructor(private readonly deps: IMarketplaceCatalogFacadeDeps) {}

  getHealth(): { domain: string; status: string; version: string } {
    return this.deps.getOrchestration().getHealth();
  }

  getHome(): {
    domain: string;
    version: string;
    sections: Array<{ id: string; title: string; type: string; order: number }>;
  } {
    return this.deps.getOrchestration().getHome();
  }

  getStores(scope?: string, valueCents?: string): {
    domain: string;
    version: string;
    scope_applied?: { scope: string; valueCents: string; filter_field: string };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      location?: { country: string; state: string; city: string; neighborhood?: string; latitude?: number; longitude?: number; visible_in_locator: boolean };
      branches: Array<{
        branch_id: string;
        name: string;
        city: string;
        location?: { country: string; state: string; city: string; neighborhood?: string; latitude?: number; longitude?: number; visible_in_locator: boolean };
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    return this.deps.getCatalog().getStores(scope, valueCents);
  }

  async getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string
  ): Promise<{
    domain: string;
    version: string;
    storeId: string;
    products: Array<{
      productId: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      attributes?: Record<string, any>;
      images?: string[];
      isEnabled: boolean;
      price: { amountCents: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
      industryId?: string;
      hubId?: string;
      isIndustrial?: boolean;
    }>;
  } | null> {
    return this.deps.getCatalogApplicationService().getStoreProducts(tenantId, storeId, categoryId ?? undefined);
  }

  get serviceOfferings() {
    return this.deps.getOfferingsApplicationService().getServiceOfferingsMap();
  }

  get serviceAvailabilities() {
    return this.deps.getOfferingsApplicationService().getServiceAvailabilitiesMap();
  }

  get serviceBookings() {
    return this.deps.getOfferingsApplicationService().getServiceBookingsMap();
  }

  getServiceBooking(bookingId: string): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
    createdAt: string;
  } | null {
    return this.deps.getOfferingsApplicationService().getServiceBooking(bookingId);
  }

  private initializeDispatchSeed(): void {
    const presence = this.deps.getDispatchPresence();
    presence.setProviderOnlineStatus('store-001', true);
    presence.setProviderOnlineStatus('store-002', true);
  }

  initializeServiceData(): void {
    this.deps.getOfferingsApplicationService().initializeOfferingsSeed();
    this.initializeDispatchSeed();
  }
}