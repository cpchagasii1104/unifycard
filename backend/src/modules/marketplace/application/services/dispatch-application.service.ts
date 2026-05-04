// backend/src/modules/marketplace/application/services/dispatch-application.service.ts
// Application Service: orquestração do domínio Dispatch (delegação ao domain module + lifecycle).

import type { MarketplaceDispatchModule } from '../../domain/dispatch/marketplace-dispatch.service';
import type {
  Order,
  ServiceRequest,
  ServiceDispatch,
  ServicePreReservation,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

export interface IDispatchOrchestratorDeps {
  getServiceOffering(offeringId: string): { isActive: boolean } | null;
  getUserRequestHistory(actorId: string): Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>;
  setUserRequestHistory(actorId: string, history: Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>): void;
  generateEconomicEvent?(event: unknown): void;
  getProviderPresence(providerActorId: string): unknown;
  getProviderResponseSLAMetrics(providerActorId: string): {
    averageResponseTimeMinutes: number;
    totalDispatchesReceived: number;
    acceptanceRate: number;
  } | null;
  calculateMatchingPriority(providerActorId: string): number;
  getServiceAvailabilities(offeringId: string): Array<{ weekday: number; starts_at: string; ends_at: string; capacity: number }> | undefined;
  getServiceBookingsMap(): Map<string, { offeringId: string; date: string; time: string; quantity: number; status: string }>;
  createServiceBooking(input: { offeringId: string; user_id: string; date: string; time: string; quantity: number }): { booking_id: string };
  expirePreReservations(): void;
}

export class DispatchApplicationService {
  constructor(
    private readonly dispatchModule: MarketplaceDispatchModule,
    private readonly deps?: IDispatchOrchestratorDeps
  ) {}

  dispatchServiceRequest(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    return this.dispatchModule.dispatchServiceRequest(tenantId, requestId);
  }

  acceptServiceDispatch(tenantId: string, dispatchId: string, providerActorId: string): Promise<Order> {
    return this.dispatchModule.acceptServiceDispatch(tenantId, dispatchId, providerActorId);
  }

  listEligibleProviders(
    tenantId: string,
    requestId: string
  ): Promise<Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
  }>> {
    return this.dispatchModule.listEligibleServiceProviders(tenantId, requestId);
  }

  getRequestStatus(requestId: string): {
    requestId: string;
    status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
    intent: 'now' | 'scheduled' | 'bundle';
    provider?: { providerActorId: string; confirmedAt: string };
    confirmed_schedule?: { date: string; time: string };
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    city: string;
    neighborhood?: string;
  } {
    return this.dispatchModule.getServiceRequestStatus(requestId);
  }

  getRequestTimeline(requestId: string): Array<{
    type: string;
    timestamp: string;
    actorId?: string;
    payload?: unknown;
  }> {
    return this.dispatchModule.getServiceRequestTimeline(requestId);
  }

  // ---------- Service Request lifecycle (extraído da facade) ----------

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
    if (!this.deps) {
      throw new Error('DispatchApplicationService: deps (orchestrator) required for createServiceRequest');
    }

    if (input.intent === 'scheduled' && !input.schedule.date) {
      throw new Error('Data é obrigatória para intent=scheduled');
    }

    if (input.intent === 'now' && !input.schedule.maxWaitMinutes) {
      throw new Error('max_wait_minutes é obrigatório para intent=now');
    }

    for (const item of input.serviceItems) {
      const offering = this.deps.getServiceOffering(item.offeringId);
      if (!offering) {
        throw new Error(`Service offering não encontrado: ${item.offeringId}`);
      }
      if (!offering.isActive) {
        throw new Error(`Service offering não está ativo: ${item.offeringId}`);
      }
      if (item.quantity <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }
    }

    if (input.intent === 'scheduled' && input.schedule.date) {
      const scheduledDate = new Date(input.schedule.date);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new Error('Data agendada deve ser futura');
      }
    }

    if (!this.checkAntiSpam(input.requesterActorId, input.serviceItems)) {
      throw new Error('Múltiplas requests simultâneas iguais detectadas. Aguarde alguns minutos.');
    }

    const requestId = `service-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: ServiceRequest = {
      requestId,
      requesterActorId: input.requesterActorId,
      city: input.city,
      neighborhood: input.neighborhood,
      intent: input.intent,
      serviceItems: input.serviceItems,
      schedule: {
        mode: input.schedule.mode,
        maxWaitMinutes: input.schedule.maxWaitMinutes,
        date: input.schedule.date,
        timeWindowMinutes: input.schedule.timeWindowMinutes,
      },
      constraints: {
        providerRadiusMode: input.constraints.providerRadiusMode,
        minTrustLevelRequired: input.constraints.minTrustLevelRequired,
        allowMultipleProviders: input.constraints.allowMultipleProviders,
      },
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.dispatchModule.setServiceRequest(requestId, request);

    const userHistory = this.deps.getUserRequestHistory(input.requesterActorId) || [];
    userHistory.push({
      requestId,
      serviceItems: input.serviceItems,
      createdAt: new Date().toISOString(),
    });
    this.deps.setUserRequestHistory(input.requesterActorId, userHistory);

    try {
      if (this.deps.generateEconomicEvent) {
        this.deps.generateEconomicEvent({
          type: 'service_request_created',
          region: { country: 'BR', state: 'PR', city: input.city },
          actorId: input.requesterActorId,
          actorType: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Requisição de serviço criada', {
      requestId,
      intent: input.intent,
      items_count: input.serviceItems.length,
    });

    return request;
  }

  private checkAntiSpam(requesterActorId: string, serviceItems: Array<{ offeringId: string; quantity: number }>): boolean {
    if (!this.deps) return true;
    const userHistory = this.deps.getUserRequestHistory(requesterActorId) || [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const recentDuplicate = userHistory.find(req => {
      if (new Date(req.createdAt) < fiveMinutesAgo) return false;
      if (req.serviceItems.length !== serviceItems.length) return false;
      const itemsMatch = req.serviceItems.every(item1 =>
        serviceItems.some(item2 => item1.offeringId === item2.offeringId && item1.quantity === item2.quantity)
      );
      return itemsMatch;
    });

    return !recentDuplicate;
  }

  expireServiceRequest(requestId: string): ServiceRequest {
    const request = this.dispatchModule.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.status !== 'open' && request.status !== 'dispatched') {
      throw new Error('Requisição não pode ser expirada (já foi aceita, cancelada ou expirada)');
    }

    const now = new Date();
    let shouldExpire = false;

    if (request.intent === 'now' && request.schedule.maxWaitMinutes) {
      const requestAge = (now.getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      if (requestAge > request.schedule.maxWaitMinutes) shouldExpire = true;
    } else if (request.intent === 'scheduled' && request.schedule.date) {
      const scheduledDate = new Date(request.schedule.date);
      if (now > scheduledDate) shouldExpire = true;
    }

    if (!shouldExpire) {
      throw new Error('Prazo ainda não expirou');
    }

    request.status = 'expired';
    request.expiredAt = new Date().toISOString();
    this.dispatchModule.setServiceRequest(requestId, request);

    const activeDispatch = Array.from(this.dispatchModule.getServiceDispatchesMap().values()).find(
      d => d.requestId === requestId && d.status === 'sent'
    );
    if (activeDispatch) {
      activeDispatch.status = 'expired';
      activeDispatch.expiredAt = new Date().toISOString();
      this.dispatchModule.setServiceDispatch(activeDispatch.dispatchId, activeDispatch);
    }

    try {
      if (this.deps?.generateEconomicEvent) {
        this.deps.generateEconomicEvent({
          type: 'service_request_created',
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: request.requesterActorId,
          actorType: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch {
      // Ignorar
    }

    marketplaceLogger.init('Requisição de serviço expirada', { requestId });
    return request;
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
    const holdDuration = input.holdDurationMinutes ?? 10;
    const expiresAt = new Date(Date.now() + holdDuration * 60 * 1000);

    const preReservationId = `pre-reservation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const preReservation: ServicePreReservation = {
      preReservationId,
      dispatchId: input.dispatchId,
      requestId: input.requestId,
      providerActorId: input.providerActorId,
      offeringId: input.offeringId,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      holdDurationMinutes: holdDuration,
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.dispatchModule.setPreReservation(preReservationId, preReservation);

    try {
      if (this.deps?.generateEconomicEvent) {
        this.deps.generateEconomicEvent({
          type: 'service_pre_reservation_created',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' },
          actorId: input.providerActorId,
          actorType: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch {
      // Ignorar
    }

    marketplaceLogger.init('Pré-reserva criada', {
      preReservationId,
      dispatchId: input.dispatchId,
      providerActorId: input.providerActorId,
      expiresAt: expiresAt.toISOString(),
    });

    return preReservation;
  }

  isSlotAvailable(offeringId: string, date: string, time: string, quantity: number): boolean {
    if (!this.deps) return false;

    const availability = this.deps.getServiceAvailabilities(offeringId);
    if (!availability || availability.length === 0) return false;

    const dateObj = new Date(date);
    const weekday = dateObj.getDay();
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) return false;

    if (time < slot.starts_at || time >= slot.ends_at) return false;

    const existingBookings = Array.from(this.deps.getServiceBookingsMap().values()).filter(
      b => b.offeringId === offeringId && b.date === date && b.time === time && b.status !== 'cancelled'
    );
    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);

    const activePreReservations = Array.from(this.dispatchModule.getServicePreReservationsMap().values()).filter(
      pr =>
        pr.offeringId === offeringId &&
        pr.date === date &&
        pr.time === time &&
        pr.status === 'active' &&
        new Date(pr.expiresAt) > new Date()
    );
    const totalHeld = activePreReservations.reduce((sum, pr) => sum + pr.quantity, 0);

    const availableCapacity = slot.capacity - totalBooked - totalHeld;
    return availableCapacity >= quantity;
  }

  checkProviderAbuse(providerActorId: string): boolean {
    if (!this.deps) return true;
    const slaMetrics = this.deps.getProviderResponseSLAMetrics(providerActorId);
    if (!slaMetrics) return true;
    if (slaMetrics.totalDispatchesReceived > 10 && slaMetrics.acceptanceRate < 30) {
      return false;
    }
    return true;
  }

  sortCandidatesDeterministically(
    candidates: Array<{
      providerActorId: string;
      offeringId: string;
      eligibilityReason: string;
      reputation_score?: number;
    }>,
    request: ServiceRequest
  ): Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
    sort_score: number;
  }> {
    if (!this.deps) {
      return candidates.map(c => ({ ...c, sort_score: 1 })).sort((a, b) => a.providerActorId.localeCompare(b.providerActorId));
    }

    return candidates
      .map(candidate => {
        const governancePriority = this.deps!.calculateMatchingPriority(candidate.providerActorId);
        const slaMetrics = this.deps!.getProviderResponseSLAMetrics(candidate.providerActorId);

        let sortScore = 1;
        if (request.constraints.providerRadiusMode === 'same_neighborhood') {
          sortScore += 2;
        } else {
          sortScore += 1;
        }

        if (slaMetrics) {
          const responseTimeScore = Math.max(0, 10 - slaMetrics.averageResponseTimeMinutes / 6);
          sortScore += responseTimeScore;
          sortScore += slaMetrics.acceptanceRate / 20;
        }

        sortScore *= governancePriority;

        return { ...candidate, sort_score: sortScore };
      })
      .sort((a, b) => {
        if (b.sort_score !== a.sort_score) return b.sort_score - a.sort_score;
        return a.providerActorId.localeCompare(b.providerActorId);
      });
  }

  createPreReservationsForDispatch(dispatchId: string, request: ServiceRequest): ServicePreReservation[] {
    const dispatch = this.dispatchModule.getServiceDispatch(dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch não encontrado');
    }

    const preReservations: ServicePreReservation[] = [];

    for (const candidate of dispatch.candidates) {
      if (!this.deps) continue;
      if (!this.checkProviderAbuse(candidate.providerActorId)) continue;

      const offering = this.deps.getServiceOffering(candidate.offeringId);
      if (!offering) continue;

      let targetDate: string;
      let targetTime: string;

      if (request.intent === 'now') {
        const now = new Date();
        targetDate = now.toISOString().split('T')[0];
        const availability = this.deps.getServiceAvailabilities(candidate.offeringId);
        if (availability && availability.length > 0) {
          const today = now.getDay();
          const todaySlot = availability.find(a => a.weekday === today);
          if (todaySlot) {
            targetTime = todaySlot.starts_at;
          } else {
            continue;
          }
        } else {
          continue;
        }
      } else if (request.intent === 'scheduled' && request.schedule.date) {
        targetDate = request.schedule.date.split('T')[0];
        const availability = this.deps.getServiceAvailabilities(candidate.offeringId);
        if (availability && availability.length > 0) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const scheduledSlot = availability.find(a => a.weekday === weekday);
          if (scheduledSlot) {
            targetTime = scheduledSlot.starts_at;
          } else {
            continue;
          }
        } else {
          continue;
        }
      } else {
        continue;
      }

      const requestItem = request.serviceItems.find(item => item.offeringId === candidate.offeringId);
      if (!requestItem) continue;

      if (!this.isSlotAvailable(candidate.offeringId, targetDate, targetTime, requestItem.quantity)) continue;

      const preReservation = this.createPreReservation({
        dispatchId,
        requestId: request.requestId,
        providerActorId: candidate.providerActorId,
        offeringId: candidate.offeringId,
        date: targetDate,
        time: targetTime,
        quantity: requestItem.quantity,
        holdDurationMinutes: 10,
      });

      preReservations.push(preReservation);
    }

    return preReservations;
  }

  confirmPreReservation(preReservationId: string): { booking_id: string; preReservationId: string } {
    if (!this.deps) {
      throw new Error('DispatchApplicationService: deps required for confirmPreReservation');
    }

    const preReservation = this.dispatchModule.getPreReservation(preReservationId);
    if (!preReservation) {
      throw new Error('Pré-reserva não encontrada');
    }

    if (preReservation.status !== 'active') {
      throw new Error('Pré-reserva não está ativa');
    }

    if (new Date(preReservation.expiresAt) < new Date()) {
      throw new Error('Pré-reserva expirada');
    }

    const request = this.dispatchModule.getServiceRequest(preReservation.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const booking = this.deps.createServiceBooking({
      offeringId: preReservation.offeringId,
      user_id: request.requesterActorId,
      date: preReservation.date,
      time: preReservation.time,
      quantity: preReservation.quantity,
    });

    preReservation.status = 'confirmed';
    preReservation.confirmedAt = new Date().toISOString();
    this.dispatchModule.setPreReservation(preReservationId, preReservation);

    try {
      if (this.deps.generateEconomicEvent) {
        this.deps.generateEconomicEvent({
          type: 'service_pre_reservation_confirmed',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' },
          actorId: preReservation.providerActorId,
          actorType: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch {
      // Ignorar
    }

    marketplaceLogger.init('Pré-reserva confirmada', {
      preReservationId,
      booking_id: booking.booking_id,
    });

    return {
      booking_id: booking.booking_id,
      preReservationId,
    };
  }
}