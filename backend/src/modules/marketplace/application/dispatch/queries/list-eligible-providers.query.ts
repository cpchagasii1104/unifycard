// backend/src/modules/marketplace/application/dispatch/queries/list-eligible-providers.query.ts
// Query: listar providers elegíveis para uma requisição (CQRS - query).

import type { MarketplaceDispatchModule } from '../../../domain/dispatch/marketplace-dispatch.service';

export type EligibleProviderResult = {
  providerActorId: string;
  offeringId: string;
  eligibilityReason: string;
  reputation_score?: number;
};

export class ListEligibleProvidersQuery {
  constructor(private readonly dispatchModule: MarketplaceDispatchModule) {}

  execute(tenantId: string, requestId: string): Promise<EligibleProviderResult[]> {
    return this.dispatchModule.listEligibleServiceProviders(tenantId, requestId);
  }
}