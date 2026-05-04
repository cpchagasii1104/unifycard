// backend/src/modules/marketplace/services/marketplace-discovery.service.ts
// Agregador: descoberta de lojas (getStoresNear, search).
// Estado vive nos domain/application; este agregador apenas delega.

import type { DiscoveryApplicationService } from '../application/services/discovery-application.service';

export class MarketplaceDiscoveryAggregatorService {
  constructor(private readonly discovery: DiscoveryApplicationService) {}

  getStoresNear(params: {
    city: string;
    neighborhood?: string;
    category_id?: string;
    template_id?: string;
  }): {
    city: string;
    filters_applied: {
      city: string;
      neighborhood?: string;
      category_id?: string;
      template_id?: string;
    };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      branches: Array<{
        branch_id: string;
        name: string;
        neighborhood?: string;
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    return this.discovery.getStoresNear(params);
  }
}