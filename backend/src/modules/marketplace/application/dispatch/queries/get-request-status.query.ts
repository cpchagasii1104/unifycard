// backend/src/modules/marketplace/application/dispatch/queries/get-request-status.query.ts
// Query: obter status atual de um ServiceRequest (CQRS - query).

import type { MarketplaceDispatchModule } from '../../../domain/dispatch/marketplace-dispatch.service';

export type RequestStatusResult = {
  requestId: string;
  status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
  intent: 'now' | 'scheduled' | 'bundle';
  provider?: { providerActorId: string; confirmedAt: string };
  confirmed_schedule?: { date: string; time: string };
  serviceItems: Array<{ offeringId: string; quantity: number }>;
  city: string;
  neighborhood?: string;
};

export class GetRequestStatusQuery {
  constructor(private readonly dispatchModule: MarketplaceDispatchModule) {}

  execute(requestId: string): RequestStatusResult {
    return this.dispatchModule.getServiceRequestStatus(requestId);
  }
}