// backend/src/modules/marketplace/application/dispatch/queries/get-request-timeline.query.ts
// Query: obter timeline de eventos de um ServiceRequest (CQRS - query).

import type { MarketplaceDispatchModule } from '../../../domain/dispatch/marketplace-dispatch.service';

export type TimelineEntry = {
  type: string;
  timestamp: string;
  actorId?: string;
  payload?: unknown;
};

export class GetRequestTimelineQuery {
  constructor(private readonly dispatchModule: MarketplaceDispatchModule) {}

  execute(requestId: string): TimelineEntry[] {
    return this.dispatchModule.getServiceRequestTimeline(requestId);
  }
}