// backend/src/modules/marketplace/domain/dispatch/marketplace-dispatch-presence.service.ts
// Single source of truth: provider presence e histórico de pedidos por utilizador.
// Estado (Maps) vive apenas aqui; facade e agregadores apenas delegam.

import { MarketplaceService } from "../../marketplace.service";

export class MarketplaceDispatchPresenceService {

  private providerOnlineStatus = new Map<string, boolean>();

  private userRequestHistory = new Map<
    string,
    Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>
  >();

  constructor(private readonly facade: MarketplaceService) {}

  setProviderOnlineStatus(providerId: string, status: boolean) {
    this.providerOnlineStatus.set(providerId, status);
  }

  getProviderOnlineStatus(providerId: string): boolean {
    return this.providerOnlineStatus.get(providerId) ?? false;
  }

  getProviderOnlineStatusMap() {
    return this.providerOnlineStatus;
  }

  getUserRequestHistory(actorId: string) {
    return this.userRequestHistory.get(actorId) ?? [];
  }

  setUserRequestHistory(
    actorId: string,
    history: Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>
  ) {
    this.userRequestHistory.set(actorId, history);
  }

  getUserRequestHistoryMap() {
    return this.userRequestHistory;
  }
}