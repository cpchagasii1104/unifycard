// backend/src/modules/marketplace/services/marketplace-dispatch.service.ts
// Agregador: dispatch de serviço, requests, pré-reservas, presence e inbox do provider.
// Estado vive nos domain services (dispatch-presence, dispatch module); este agregador apenas delega.

import type {
  ServiceRequest,
  ServiceDispatch,
  ServicePreReservation,
  Order,
  DisputeCase,
  ProviderPresence,
} from '@contracts/marketplace';
import type { DispatchApplicationService } from '../application/services/dispatch-application.service';
import type { MarketplaceDispatchModule } from '../domain/dispatch/marketplace-dispatch.service';
import type { OfferingsApplicationService } from '../application/services/offerings-application.service';

/** Tipo local mínimo para o domínio de dispatch (ex-sub-services). */
type DispatchDomainService = {
  getServiceDispatch(dispatchId: string): ServiceDispatch | null;
  updateServiceDispatch(dispatchId: string, patch: Partial<ServiceDispatch>): void;
  recordDispatchResponse(dispatchId: string, status: 'accepted' | 'declined'): void;
  getDispatchStatusForProvider(dispatchId: string, providerActorId: string): {
    dispatchId: string;
    providerActorId: string;
    is_eligible: boolean;
    pre_reservation_status?: 'active' | 'expired' | 'confirmed' | 'released';
    pre_reservation_expiresAt?: string;
    time_remaining_minutes?: number;
    alreadyAccepted: boolean;
    acceptedBy?: string;
  };
  expirePreReservations(): void;
  getPreReservation(preReservationId: string): ServicePreReservation | null;
  getPreReservationsByDispatch(dispatchId: string): ServicePreReservation[];
};

/** Tipo local mínimo para o serviço de dispatch (ex-sub-services). */
type DispatchService = {
  recordDispatchSent(dispatchId: string, providerActorId: string, requestId: string): void;
  updateProviderPresence(input: {
    providerActorId: string;
    status: 'online' | 'offline';
    region: { country: string; state: string; city: string; neighborhood?: string };
  }): ProviderPresence;
  getProviderPresence(providerActorId: string): ProviderPresence | null;
  getProviderDispatchInbox?(providerActorId: string): Array<{
    dispatchId: string;
    requestId: string;
    request_summary: unknown;
    pre_reservation?: unknown;
    status: string;
    createdAt: string;
  }>;
  getProviderResponseSLAMetrics(providerActorId: string): {
    averageResponseTimeMinutes: number;
    totalDispatchesReceived: number;
    totalDispatchesAccepted: number;
    totalDispatchesDeclined: number;
    acceptanceRate: number;
    lastResponseTimeMinutes?: number;
  } | null;
};

export interface IDispatchAggregatorDeps {
  dispatchApplicationService: DispatchApplicationService;
  dispatchModule: MarketplaceDispatchModule;
  dispatchDomainService?: DispatchDomainService;
  dispatchService?: DispatchService;
  offeringsApplicationService: OfferingsApplicationService;
  getDisputeCasesMap(): Map<string, DisputeCase>;
  getProviderDispatchInbox(providerActorId: string): Array<{
    dispatchId: string;
    requestId: string;
    request_summary: unknown;
    pre_reservation?: unknown;
    status: string;
    createdAt: string;
  }>;
  presence: { set(providerActorId: string, online: boolean): void; get(providerActorId: string): boolean };
}

export class MarketplaceDispatchAggregatorService {
  constructor(private readonly deps: IDispatchAggregatorDeps) {}

  createServiceRequest(input: {
    requesterActorId: string;
    city: string;
    neighborhood?: string;
    intent: 'now' | 'scheduled' | 'bundle';
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    schedule: {
      mode: 'now' | 'scheduled';
      maxWaitMinutes?: number;
      date?: string;
      timeWindowMinutes?: number;
    };
    constraints: {
      providerRadiusMode: 'same_neighborhood' | 'same_city';
      minTrustLevelRequired: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
      allowMultipleProviders: boolean;
    };
  }): ServiceRequest {
    return this.deps.dispatchApplicationService.createServiceRequest(input);
  }

  async listEligibleServiceProviders(
    tenantId: string,
    requestId: string
  ): Promise<Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
  }>> {
    return this.deps.dispatchApplicationService.listEligibleProviders(tenantId, requestId);
  }

  async dispatchServiceRequest(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    return this.deps.dispatchApplicationService.dispatchServiceRequest(tenantId, requestId);
  }

  acceptServiceDispatch(tenantId: string, dispatchId: string, providerActorId: string): Promise<Order> {
    return this.deps.dispatchApplicationService.acceptServiceDispatch(tenantId, dispatchId, providerActorId);
  }

  expireServiceRequest(requestId: string): ServiceRequest {
    return this.deps.dispatchApplicationService.expireServiceRequest(requestId);
  }

  getServiceRequest(requestId: string): ServiceRequest | null {
    return this.deps.dispatchModule.getServiceRequest(requestId) ?? null;
  }

  getServiceDispatch(dispatchId: string): ServiceDispatch | null {
    return this.deps.dispatchDomainService?.getServiceDispatch(dispatchId)
      ?? this.deps.dispatchModule.getServiceDispatch(dispatchId)
      ?? null;
  }

  updateServiceDispatch(dispatchId: string, patch: Partial<ServiceDispatch>): void {
    if (this.deps.dispatchDomainService) {
      this.deps.dispatchDomainService.updateServiceDispatch(dispatchId, patch);
    } else {
      this.deps.dispatchModule.updateServiceDispatch(dispatchId, patch);
    }
  }

  setProviderOnlineStatus(providerActorId: string, online: boolean): void {
    this.deps.presence.set(providerActorId, online);
  }

  getProviderOnlineStatus(providerActorId: string): boolean {
    return this.deps.presence.get(providerActorId);
  }

  getDisputeCasesMap(): Map<string, DisputeCase> {
    return this.deps.getDisputeCasesMap();
  }

  getBookingsByOfferingDateTime(
    offeringId: string,
    date: string,
    time: string
  ): Array<{
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: string;
    createdAt: string;
  }> {
    return this.deps.offeringsApplicationService.getBookingsByOfferingDateTime(
      offeringId,
      date,
      time
    );
  }

  recordDispatchSent(dispatchId: string, providerActorId: string, requestId: string): void {
    this.deps.dispatchService?.recordDispatchSent(dispatchId, providerActorId, requestId);
  }

  updateProviderPresence(input: {
    providerActorId: string;
    status: 'online' | 'offline';
    region: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
    };
  }): ProviderPresence {
    if (this.deps.dispatchService) {
      return this.deps.dispatchService.updateProviderPresence(input);
    }
    this.deps.presence.set(input.providerActorId, input.status === 'online');
    return {
      presenceId: `presence-${input.providerActorId}`,
      providerActorId: input.providerActorId,
      status: input.status,
      region: input.region,
      lastSeen: new Date().toISOString(),
      responseSlaMetrics: {
        averageResponseTimeMinutes: 0,
        totalDispatchesReceived: 0,
        totalDispatchesAccepted: 0,
        totalDispatchesDeclined: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  getProviderPresence(providerActorId: string): ProviderPresence | null {
    if (this.deps.dispatchService) {
      return this.deps.dispatchService.getProviderPresence(providerActorId);
    }
    return this.deps.presence.get(providerActorId)
      ? {
          presenceId: `presence-${providerActorId}`,
          providerActorId,
          status: 'online',
          region: { country: '', state: '', city: '' },
          lastSeen: new Date().toISOString(),
          responseSlaMetrics: {
            averageResponseTimeMinutes: 0,
            totalDispatchesReceived: 0,
            totalDispatchesAccepted: 0,
            totalDispatchesDeclined: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null;
  }

  recordDispatchResponse(dispatchId: string, status: 'accepted' | 'declined'): void {
    if (this.deps.dispatchDomainService) {
      this.deps.dispatchDomainService.recordDispatchResponse(dispatchId, status);
    } else {
      this.deps.dispatchModule.updateServiceDispatch(dispatchId, { status });
    }
  }

  getProviderResponseSLAMetrics(providerActorId: string): {
    averageResponseTimeMinutes: number;
    totalDispatchesReceived: number;
    totalDispatchesAccepted: number;
    totalDispatchesDeclined: number;
    acceptanceRate: number;
    lastResponseTimeMinutes?: number;
  } | null {
    return this.deps.dispatchService?.getProviderResponseSLAMetrics(providerActorId) ?? null;
  }

  getProviderDispatchInbox(providerActorId: string): Array<{
    dispatchId: string;
    requestId: string;
    request_summary: unknown;
    pre_reservation?: unknown;
    status: string;
    createdAt: string;
  }> {
    return this.deps.getProviderDispatchInbox(providerActorId);
  }

  getDispatchStatusForProvider(
    dispatchId: string,
    providerActorId: string
  ): {
    dispatchId: string;
    providerActorId: string;
    is_eligible: boolean;
    pre_reservation_status?: 'active' | 'expired' | 'confirmed' | 'released';
    pre_reservation_expiresAt?: string;
    time_remaining_minutes?: number;
    alreadyAccepted: boolean;
    acceptedBy?: string;
  } {
    if (this.deps.dispatchDomainService) {
      return this.deps.dispatchDomainService.getDispatchStatusForProvider(
        dispatchId,
        providerActorId
      );
    }
    const dispatch = this.deps.dispatchModule.getServiceDispatch(dispatchId);
    if (!dispatch) throw new Error('Dispatch não encontrado');
    const candidate = dispatch.candidates?.find((c: { providerActorId: string }) => c.providerActorId === providerActorId);
    const isEligible = !!candidate;
    const preReservations = this.deps.dispatchModule
      .getPreReservationsByDispatch(dispatchId)
      .filter((pr: ServicePreReservation) => pr.providerActorId === providerActorId);
    const activePreReservation = preReservations.find((pr: ServicePreReservation) => pr.status === 'active');
    const confirmedPreReservation = preReservations.find((pr: ServicePreReservation) => pr.status === 'confirmed');
    let pre_reservation_status: 'active' | 'expired' | 'confirmed' | 'released' | undefined;
    let pre_reservation_expiresAt: string | undefined;
    let time_remaining_minutes: number | undefined;
    if (activePreReservation) {
      pre_reservation_status = 'active';
      pre_reservation_expiresAt = activePreReservation.expiresAt;
      const now = new Date();
      const expires = new Date(activePreReservation.expiresAt);
      time_remaining_minutes = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / (1000 * 60)));
    } else if (confirmedPreReservation) {
      pre_reservation_status = 'confirmed';
    } else if (preReservations.length > 0) {
      const expired = preReservations.find((pr: ServicePreReservation) => pr.status === 'expired');
      pre_reservation_status = expired ? 'expired' : 'released';
    }
    return {
      dispatchId,
      providerActorId,
      is_eligible: isEligible,
      pre_reservation_status,
      pre_reservation_expiresAt,
      time_remaining_minutes,
      alreadyAccepted: dispatch.status === 'accepted',
      acceptedBy: dispatch.acceptedBy,
    };
  }

  getServiceDispatchesMap(): Map<string, ServiceDispatch> {
    return this.deps.dispatchModule.getServiceDispatchesMap();
  }

  getServiceRequestsMap(): Map<string, ServiceRequest> {
    return this.deps.dispatchModule.getServiceRequestsMap();
  }

  getServicePreReservationsMap(): Map<string, ServicePreReservation> {
    return this.deps.dispatchModule.getServicePreReservationsMap();
  }

  expirePreReservations(): void {
    if (this.deps.dispatchDomainService) {
      this.deps.dispatchDomainService.expirePreReservations();
    } else {
      this.deps.dispatchModule.expirePreReservations();
    }
  }

  getPreReservation(preReservationId: string): ServicePreReservation | null {
    return this.deps.dispatchDomainService?.getPreReservation(preReservationId)
      ?? this.deps.dispatchModule.getPreReservation(preReservationId)
      ?? null;
  }

  getPreReservationsByDispatch(dispatchId: string): ServicePreReservation[] {
    return this.deps.dispatchDomainService?.getPreReservationsByDispatch(dispatchId)
      ?? this.deps.dispatchModule.getPreReservationsByDispatch(dispatchId);
  }

  getServiceRequestTimeline(requestId: string): Array<{
    type: string;
    timestamp: string;
    actorId?: string;
    payload?: unknown;
  }> {
    return this.deps.dispatchApplicationService.getRequestTimeline(requestId);
  }

  getServiceRequestStatus(requestId: string): {
    requestId: string;
    status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
    intent: 'now' | 'scheduled' | 'bundle';
    provider?: { providerActorId: string; confirmedAt: string };
    confirmed_schedule?: { date: string; time: string };
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    city: string;
    neighborhood?: string;
  } {
    return this.deps.dispatchApplicationService.getRequestStatus(requestId);
  }

  createPreReservation(input: {
    dispatchId: string;
    requestId: string;
    providerActorId: string;
    offeringId: string;
    date: string;
    time: string;
    quantity: number;
    holdDurationMinutes?: number;
  }): ServicePreReservation {
    return this.deps.dispatchApplicationService.createPreReservation(input);
  }

  isSlotAvailable(offeringId: string, date: string, time: string, quantity: number): boolean {
    return this.deps.dispatchApplicationService.isSlotAvailable(offeringId, date, time, quantity);
  }

  sortCandidatesDeterministically(
    candidates: Array<{ providerActorId: string; offeringId: string; eligibilityReason: string; reputation_score?: number }>,
    request: ServiceRequest
  ): Array<{ providerActorId: string; offeringId: string; eligibilityReason: string; reputation_score?: number; sort_score: number }> {
    return this.deps.dispatchApplicationService.sortCandidatesDeterministically(candidates, request);
  }

  checkProviderAbuse(providerActorId: string): boolean {
    return this.deps.dispatchApplicationService.checkProviderAbuse(providerActorId);
  }

  createPreReservationsForDispatch(dispatchId: string, request: ServiceRequest): ServicePreReservation[] {
    return this.deps.dispatchApplicationService.createPreReservationsForDispatch(dispatchId, request);
  }

  confirmPreReservation(preReservationId: string): { booking_id: string; preReservationId: string } {
    return this.deps.dispatchApplicationService.confirmPreReservation(preReservationId);
  }
}