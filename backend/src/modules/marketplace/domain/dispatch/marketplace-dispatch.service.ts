// backend/src/modules/marketplace/domain/dispatch/marketplace-dispatch.service.ts
// Módulo de dispatch e requests de serviço (estado e lógica extraídos da facade).

import { createHash } from 'crypto';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import type { MarketplaceService } from '../../marketplace.service';
import type {
  ServiceRequest,
  ServiceDispatch,
  ServicePreReservation,
  Order,
} from '@contracts/marketplace';
import { economicIdentityService } from '../../economic-identity.service';
import { marketplaceLogger } from '../../marketplace.logger';
import type { EventBus } from '../../application/events/event-bus';
import {
  DispatchAcceptedEvent,
  type DispatchAcceptedEventPayload,
} from './events/dispatch-accepted.event';
import type { IMarketplaceStateReader } from '../../state/marketplace-state.adapter';

function deterministicMarketplaceDispatchAcceptedOutboxEventId(tenantId: string, dispatchId: string): string {
  const hash = createHash('sha256')
    .update(`MARKETPLACE_DISPATCH_ACCEPTED:${tenantId}:${dispatchId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export class MarketplaceDispatchModule {
  /**
   * Service Requests (in-memory)
   * Armazena requisições de serviços
   */
  private _serviceRequests: Map<string, ServiceRequest> = new Map(); // requestId -> request

  /**
   * Service Dispatches (in-memory)
   * Armazena dispatches de requisições
   */
  private _serviceDispatches: Map<string, ServiceDispatch> = new Map(); // dispatch_id -> dispatch

  /**
   * Service Pre-Reservations (in-memory)
   * Armazena pré-reservas temporárias na agenda
   */
  private _servicePreReservations: Map<string, ServicePreReservation> = new Map(); // pre_reservation_id -> pre_reservation

  constructor(
    private readonly facade: MarketplaceService,
    _eventBus: EventBus,
    private readonly state?: IMarketplaceStateReader
  ) {}

  getServiceDispatchesMap(): Map<string, ServiceDispatch> {
    return this._serviceDispatches;
  }

  getServiceRequestsMap(): Map<string, ServiceRequest> {
    return this._serviceRequests;
  }

  getServicePreReservationsMap(): Map<string, ServicePreReservation> {
    return this._servicePreReservations;
  }

  getAllServiceDispatches(): IterableIterator<ServiceDispatch> {
    return this._serviceDispatches.values();
  }

  getServiceDispatch(dispatchId: string): ServiceDispatch | null {
    return this._serviceDispatches.get(dispatchId) ?? null;
  }

  getServiceRequest(requestId: string): ServiceRequest | null {
    return this._serviceRequests.get(requestId) ?? null;
  }

  getPreReservationsByDispatch(dispatchId: string): ServicePreReservation[] {
    return Array.from(this._servicePreReservations.values())
      .filter(pr => pr.dispatchId === dispatchId);
  }

  /**
   * Buscar dispatch aceito por requestId (helper para evitar duplicação)
   */
  getAcceptedDispatchByRequestId(requestId: string): ServiceDispatch | null {
    return Array.from(this._serviceDispatches.values())
      .find(d => d.requestId === requestId && d.status === 'accepted') ?? null;
  }

  getPreReservation(preReservationId: string): ServicePreReservation | null {
    return this._servicePreReservations.get(preReservationId) ?? null;
  }

  updateServiceDispatch(dispatchId: string, patch: Partial<ServiceDispatch>): void {
    const d = this._serviceDispatches.get(dispatchId);
    if (!d) return;
    this._serviceDispatches.set(dispatchId, { ...d, ...patch });
  }

  setServiceRequest(requestId: string, request: ServiceRequest): void {
    this._serviceRequests.set(requestId, request);
  }

  setServiceDispatch(dispatchId: string, dispatch: ServiceDispatch): void {
    this._serviceDispatches.set(dispatchId, dispatch);
  }

  setPreReservation(preReservationId: string, preReservation: ServicePreReservation): void {
    this._servicePreReservations.set(preReservationId, preReservation);
  }

  private async enqueueDispatchAcceptedOutbox(
    tenantId: string,
    payload: DispatchAcceptedEventPayload
  ): Promise<void> {
    try {
      const outboxClient = await getClientWithTenant(tenantId);
      try {
        await outboxClient.query('BEGIN');
        await insertEventOutboxRow(outboxClient, {
          tenantId,
          eventId: deterministicMarketplaceDispatchAcceptedOutboxEventId(tenantId, payload.dispatchId),
          eventType: DispatchAcceptedEvent.name,
          eventVersion: 1,
          payload: {
            dispatchId: payload.dispatchId,
            providerActorId: payload.providerActorId,
            orderId: payload.orderId,
          },
          metadata: {},
        });
        await outboxClient.query('COMMIT');
      } catch (outboxErr) {
        await outboxClient.query('ROLLBACK');
        throw outboxErr;
      } finally {
        outboxClient.release();
      }
    } catch (error) {
      console.error('Erro ao enfileirar DispatchAccepted na outbox (não crítico):', error);
    }
  }

  expirePreReservations(): void {
    const now = new Date();
    const expiredPreReservations: ServicePreReservation[] = [];
    for (const preReservation of this._servicePreReservations.values()) {
      if (preReservation.status === 'active' && new Date(preReservation.expiresAt) < now) {
        preReservation.status = 'expired';
        preReservation.expiredAt = now.toISOString();
        this._servicePreReservations.set(preReservation.preReservationId, preReservation);
        expiredPreReservations.push(preReservation);
        try {
          const facadeAny = this.facade;
          if (typeof facadeAny.generateEconomicEvent === 'function') {
            facadeAny.generateEconomicEvent({
              type: 'service_pre_reservation_expired',
              region: { country: 'BR', state: 'PR', city: 'Curitiba' },
              actorId: preReservation.providerActorId,
              actorType: 'service_provider',
              referenceId: preReservation.preReservationId,
              visibility: { scope: 'restricted' },
            });
          }
        } catch {
          // ignorar
        }
      }
    }
    if (expiredPreReservations.length > 0) {
      marketplaceLogger.init('Pré-reservas expiradas', { count: expiredPreReservations.length });
    }
  }

  /**
   * Listar providers elegíveis (determinístico)
   */
  async listEligibleServiceProviders(tenantId: string, requestId: string): Promise<Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
  }>> {
    const request = this.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const candidates: Array<{
      providerActorId: string;
      offeringId: string;
      eligibilityReason: string;
      reputation_score?: number;
    }> = [];

    for (const item of request.serviceItems) {
      const offering = this.facade.serviceOfferings.get(item.offeringId);
      if (!offering) {
        continue;
      }

      const providersWithOffering = Array.from(this.facade.serviceOfferings.entries())
        .filter(([offeringKey, o]) => offeringKey === item.offeringId && o.isActive)
        .map(([, o]) => o.storeId);

      for (const providerId of providersWithOffering) {
        const presence = this.facade.dispatch.getProviderPresence(providerId);
        const isOnline = presence ? presence.status === 'online' : this.facade.dispatch.getProviderOnlineStatus(providerId);
        if (!isOnline) {
          continue;
        }

        const availability = this.facade.serviceAvailabilities.get(item.offeringId);
        if (!availability || availability.length === 0) {
          continue;
        }

        let availabilityMatches = false;
        if (request.intent === 'now') {
          const today = new Date();
          const weekday = today.getDay();
          const todayAvailability = availability.find(a => a.weekday === weekday);
          if (todayAvailability && todayAvailability.capacity > 0) {
            availabilityMatches = true;
          }
        } else if (request.intent === 'scheduled' && request.schedule.date) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const scheduledAvailability = availability.find(a => a.weekday === weekday);
          if (scheduledAvailability && scheduledAvailability.capacity > 0) {
            availabilityMatches = true;
          }
        }

        if (!availabilityMatches) {
          continue;
        }

        const identity = await economicIdentityService.getEconomicIdentity(tenantId, providerId);
        if (!identity) {
          continue;
        }

        const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
        const requiredLevel = trustLevels[request.constraints.minTrustLevelRequired] || 0;
        const providerLevel = trustLevels[identity.trustLevel] || 0;

        if (providerLevel < requiredLevel) {
          continue;
        }

        const storesData = this.facade.catalog.getStores();
        const store = storesData.stores.find(s => s.storeId === providerId);
        if (!store) {
          continue;
        }

        let regionMatches = false;
        if (request.constraints.providerRadiusMode === 'same_neighborhood') {
          const branchInNeighborhood = store.branches.some(
            b => b.location?.city === request.city && b.location?.neighborhood === request.neighborhood
          );
          if (branchInNeighborhood) {
            regionMatches = true;
          }
        } else if (request.constraints.providerRadiusMode === 'same_city') {
          const branchInCity = store.branches.some(b => b.location?.city === request.city);
          if (branchInCity) {
            regionMatches = true;
          }
        }

        if (!regionMatches) {
          continue;
        }

        const disputes = Array.from((this.state?.disputeCases ?? this.facade.dispatch.getDisputeCasesMap()).values()).filter(
          d => d.actorInvolved.actorId === providerId && d.status === 'open'
        );
        if (disputes.length > 0) {
          continue;
        }

        const offeringForCapacity = this.facade.serviceOfferings.get(item.offeringId);
        if (offeringForCapacity) {
          const serviceTemplateId = offeringForCapacity.templateId;
          const targetDate = request.intent === 'now'
            ? new Date().toISOString().split('T')[0]
            : request.schedule.date
            ? request.schedule.date.split('T')[0]
            : null;
          const targetTime = request.intent === 'now'
            ? new Date().toTimeString().split(' ')[0].substring(0, 5)
            : '09:00';

          if (targetDate) {
            const resourceAvailability = this.facade.capacity.checkResourceAvailability(
              serviceTemplateId,
              providerId,
              targetDate,
              targetTime
            );

            if (!resourceAvailability.available) {
              this.facade.capacityModule.recordCapacityEvent({
                resourceId: resourceAvailability.missing_resources[0],
                storeId: providerId,
                companyId: providerId,
                eventType: 'service_rejected_capacity',
                details: {
                  serviceRequestId: requestId,
                  reason: `Recursos necessários não disponíveis: ${resourceAvailability.missing_resources.join(', ')}`,
                },
              });
              continue;
            }

            const eligibleResources = this.facade.capacity.getEligibleResourcesForMatching(providerId, serviceTemplateId);
            if (eligibleResources.length === 0) {
              continue;
            }
          }
        }

        const eligibilityReason = `Provider elegível: online, disponível, trust ${identity.trustLevel}, região compatível, capacidade disponível`;

        const snapshots = this.facade.governance.getReputationSnapshots(providerId);
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const reputationScore = latestSnapshot ? latestSnapshot.score.finalScore : undefined;

        candidates.push({
          providerActorId: providerId,
          offeringId: item.offeringId,
          eligibilityReason: eligibilityReason,
          reputation_score: reputationScore,
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.reputation_score !== undefined && b.reputation_score !== undefined) {
        if (b.reputation_score !== a.reputation_score) {
          return b.reputation_score - a.reputation_score;
        }
      } else if (a.reputation_score !== undefined) {
        return -1;
      } else if (b.reputation_score !== undefined) {
        return 1;
      }

      return a.providerActorId.localeCompare(b.providerActorId);
    });

    return candidates;
  }

  /**
   * Dispatch de requisição de serviço
   */
  async dispatchServiceRequest(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    const request = this.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.status !== 'open') {
      throw new Error('Requisição não está aberta para dispatch');
    }

    const existingDispatch = Array.from(this.getServiceDispatchesMap().values()).find(
      d => d.requestId === requestId && (d.status === 'sent' || d.status === 'accepted')
    );

    if (existingDispatch) {
      const dispatchAge = Date.now() - new Date(existingDispatch.createdAt).getTime();
      const tenMinutes = 10 * 60 * 1000;
      if (dispatchAge < tenMinutes) {
        throw new Error('Já existe dispatch ativo para esta requisição (aguarde 10 minutos)');
      }
    }

    const candidates = await this.listEligibleServiceProviders(tenantId, requestId);

    if (candidates.length === 0) {
      throw new Error('Nenhum provider elegível encontrado');
    }

    const sortedCandidates = this.facade.dispatch.sortCandidatesDeterministically(candidates, request);

    const limitedCandidates = sortedCandidates.slice(0, 20);

    const dispatchId = `service-dispatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dispatch: ServiceDispatch = {
      dispatchId,
      requestId,
      candidates: limitedCandidates.map(c => ({
        providerActorId: c.providerActorId,
        offeringId: c.offeringId,
        eligibilityReason: c.eligibilityReason,
      })),
      rulesApplied: {
        trust: true,
        availability: true,
        online: true,
        region: true,
      },
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    this.setServiceDispatch(dispatchId, dispatch);

    const preReservations = this.facade.dispatch.createPreReservationsForDispatch(dispatchId, request);

    for (const candidate of limitedCandidates) {
      this.facade.dispatch.recordDispatchSent(dispatchId, candidate.providerActorId, requestId);
    }

    marketplaceLogger.init('Pré-reservas criadas para dispatch', {
      dispatchId: dispatchId,
      pre_reservations_count: preReservations.length,
    });

    request.status = 'dispatched';
    request.dispatchedAt = new Date().toISOString();
    this.setServiceRequest(requestId, request);

    marketplaceLogger.init('Dispatch de requisição de serviço criado', {
      dispatchId: dispatchId,
      requestId: requestId,
      candidates_count: limitedCandidates.length,
    });

    return dispatch;
  }

  /**
   * Aceitar dispatch de serviço
   */
  async acceptServiceDispatch(
    tenantId: string,
    dispatchId: string,
    providerActorId: string
  ): Promise<Order> {
    const dispatch = this.getServiceDispatch(dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch não encontrado');
    }

    if (dispatch.status !== 'sent') {
      throw new Error('Dispatch não está disponível para aceitação');
    }

    const candidate = dispatch.candidates.find(c => c.providerActorId === providerActorId);
    if (!candidate) {
      throw new Error('Provider não é candidato deste dispatch');
    }

    const request = this.getServiceRequest(dispatch.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const preReservations = this.getPreReservationsByDispatch(dispatchId)
      .filter(pr => pr.providerActorId === providerActorId && pr.status === 'active');

    const bookingIds: string[] = [];
    for (const preReservation of preReservations) {
      try {
        const confirmed = this.facade.dispatch.confirmPreReservation(preReservation.preReservationId);
        bookingIds.push(confirmed.booking_id);
      } catch (err) {
        marketplaceLogger.error('Erro ao confirmar pré-reserva', err);
      }
    }

    if (bookingIds.length === 0) {
      throw new Error('Nenhuma pré-reserva ativa encontrada para este provider');
    }

    this.facade.dispatch.recordDispatchResponse(dispatchId, 'accepted');

    dispatch.status = 'accepted';
    dispatch.acceptedBy = providerActorId;
    dispatch.acceptedAt = new Date().toISOString();
    this.setServiceDispatch(dispatchId, dispatch);

    request.status = 'accepted';
    request.acceptedAt = new Date().toISOString();
    this.setServiceRequest(dispatch.requestId, request);

    if (request.intent === 'quote_required') {
      const visit = this.facade.services.createServiceVisit({
        requestId: request.requestId,
        dispatchId: dispatchId,
        providerActorId: providerActorId,
        scheduledDate: request.schedule.date || new Date().toISOString().split('T')[0],
        scheduledTime: '09:00',
      });

      try {
        const facadeAny = this.facade;
        if (typeof facadeAny.generateEconomicEvent === 'function') {
          facadeAny.generateEconomicEvent({
            type: 'service_visit_scheduled',
            region: { country: 'BR', state: 'PR', city: request.city },
            actorId: providerActorId,
            actorType: 'service_provider',
            reference_id: visit.visitId,
            visibility: { scope: 'local' },
          });
        }
      } catch {
        // ignorar
      }

      marketplaceLogger.init('Visita de orçamento agendada', {
        visitId: visit.visitId,
        requestId: request.requestId,
        providerActorId: providerActorId,
      });

      const storesData = this.facade.catalog.getStores();
      const firstStore = storesData.stores[0];
      if (!firstStore) {
        throw new Error('Nenhuma loja disponível para criar order');
      }

      const order = this.facade.orders.createOrder(providerActorId);
      await this.enqueueDispatchAcceptedOutbox(tenantId, {
        dispatchId,
        providerActorId,
        orderId: order.orderId,
      });
      return order;
    }

    let finalBookingIds = bookingIds;

    if (finalBookingIds.length === 0) {
      const manualBookingIds: string[] = [];

      if (request.intent === 'now') {
        for (const item of request.serviceItems) {
          const offering = this.facade.serviceOfferings.get(item.offeringId);
          if (!offering) continue;

          const today = new Date();
          const weekday = today.getDay();
          const availability = this.facade.serviceAvailabilities.get(item.offeringId);
          const todayAvailability = availability?.find(a => a.weekday === weekday);

          if (todayAvailability) {
            const booking = this.facade.services.createServiceBooking({
              offeringId: item.offeringId,
              user_id: request.requesterActorId,
              date: today.toISOString().split('T')[0],
              time: todayAvailability.starts_at,
              quantity: item.quantity,
            });
            manualBookingIds.push(booking.booking_id);
          }
        }
        finalBookingIds = manualBookingIds;
      } else if (request.intent === 'scheduled' && request.schedule.date) {
        for (const item of request.serviceItems) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const availability = this.facade.serviceAvailabilities.get(item.offeringId);
          const scheduledAvailability = availability?.find(a => a.weekday === weekday);

          if (scheduledAvailability) {
            const booking = this.facade.services.createServiceBooking({
              offeringId: item.offeringId,
              user_id: request.requesterActorId,
              date: request.schedule.date.split('T')[0],
              time: scheduledAvailability.starts_at,
              quantity: item.quantity,
            });
            manualBookingIds.push(booking.booking_id);
          }
        }
        finalBookingIds = manualBookingIds;
      } else if (request.intent === 'bundle') {
        const manualBookingIdsBundle: string[] = [];
        if (request.constraints.allowMultipleProviders) {
          for (const item of request.serviceItems) {
            const itemCandidate = dispatch.candidates.find(c => c.offeringId === item.offeringId);
            if (itemCandidate) {
              const offering = this.facade.serviceOfferings.get(item.offeringId);
              if (offering) {
                const booking = this.facade.services.createServiceBooking({
                  offeringId: item.offeringId,
                  user_id: request.requesterActorId,
                  date: request.schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                  time: '09:00',
                  quantity: item.quantity,
                });
                manualBookingIdsBundle.push(booking.booking_id);
              }
            }
          }
        } else {
          const allOfferingsCovered = request.serviceItems.every(item =>
            dispatch.candidates.some(c => c.offeringId === item.offeringId && c.providerActorId === providerActorId)
          );
          if (!allOfferingsCovered) {
            throw new Error('Provider não cobre todos os serviços do bundle');
          }
          for (const item of request.serviceItems) {
            const offering = this.facade.serviceOfferings.get(item.offeringId);
            if (offering) {
              const booking = this.facade.services.createServiceBooking({
                offeringId: item.offeringId,
                user_id: request.requesterActorId,
                date: request.schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                time: '09:00',
                quantity: item.quantity,
              });
              manualBookingIdsBundle.push(booking.booking_id);
            }
          }
        }
        finalBookingIds = manualBookingIdsBundle;
      }
    }

    if (finalBookingIds.length === 0) {
      throw new Error('Nenhum booking criado para este dispatch');
    }

    const storesData = this.facade.catalog.getStores();
    const firstStore = storesData.stores[0];
    if (!firstStore) {
      throw new Error('Nenhuma loja disponível para criar order');
    }

    const userOrder = this.facade.orders.createOrder(providerActorId);

    for (const bookingId of finalBookingIds) {
      const confirmed = this.facade.services.confirmServiceBooking(bookingId);
      this.facade.services.addServiceOrderToOrder(userOrder.orderId, confirmed.orderId);
    }

    try {
      const facadeAny = this.facade;
      if (typeof facadeAny.generateEconomicEvent === 'function') {
        const eventType = request.intent === 'bundle' ? 'bundle_service_booked' : 'service_request_accepted';
        facadeAny.generateEconomicEvent({
          type: eventType,
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: providerActorId,
          actorType: 'service_provider',
          reference_id: dispatchId,
          visibility: { scope: 'local' },
        });
      }
    } catch {
      // ignorar
    }

    marketplaceLogger.init('Dispatch de serviço aceito', {
      dispatchId: dispatchId,
      providerActorId: providerActorId,
      bookings_count: finalBookingIds.length,
      orderId: userOrder.orderId,
    });

    await this.enqueueDispatchAcceptedOutbox(tenantId, {
      dispatchId,
      providerActorId,
      orderId: userOrder.orderId,
    });

    return userOrder;
  }

  /**
   * Buscar timeline de eventos de um ServiceRequest
   */
  getServiceRequestTimeline(requestId: string): Array<{
    type: string;
    timestamp: string;
    actorId?: string;
    payload?: any;
  }> {
    const request = this.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const timeline: Array<{ type: string; timestamp: string; actorId?: string; payload?: any }> = [];

    timeline.push({
      type: 'service_request_created',
      timestamp: request.createdAt,
      actorId: request.requesterActorId,
      payload: {
        intent: request.intent,
        serviceItems: request.serviceItems,
        city: request.city,
        neighborhood: request.neighborhood,
      },
    });

    const dispatches = Array.from(this.getServiceDispatchesMap().values())
      .filter(d => d.requestId === requestId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const dispatch of dispatches) {
      timeline.push({
        type: 'service_dispatch_sent',
        timestamp: dispatch.createdAt,
        payload: {
          dispatchId: dispatch.dispatchId,
          candidates_count: dispatch.candidates.length,
          candidates: dispatch.candidates.map(c => ({ providerActorId: c.providerActorId, offeringId: c.offeringId })),
        },
      });

      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatchId);
      for (const preReservation of preReservations) {
        timeline.push({
          type: 'service_pre_reservation_created',
          timestamp: preReservation.createdAt,
          actorId: preReservation.providerActorId,
          payload: {
            preReservationId: preReservation.preReservationId,
            date: preReservation.date,
            time: preReservation.time,
            expiresAt: preReservation.expiresAt,
          },
        });

        if (preReservation.status === 'expired') {
          timeline.push({
            type: 'service_pre_reservation_expired',
            timestamp: preReservation.expiresAt,
            actorId: preReservation.providerActorId,
            payload: { preReservationId: preReservation.preReservationId },
          });
        }

        if (preReservation.status === 'confirmed' && preReservation.confirmedAt) {
          timeline.push({
            type: 'service_pre_reservation_confirmed',
            timestamp: preReservation.confirmedAt,
            actorId: preReservation.providerActorId,
            payload: { preReservationId: preReservation.preReservationId },
          });
        }
      }

      if (dispatch.status === 'declined') {
        timeline.push({
          type: 'service_dispatch_declined',
          timestamp: dispatch.expiredAt || dispatch.createdAt,
          actorId: dispatch.acceptedBy,
          payload: { dispatchId: dispatch.dispatchId },
        });
      }

      if (dispatch.status === 'accepted' && dispatch.acceptedAt) {
        timeline.push({
          type: 'service_dispatch_accepted',
          timestamp: dispatch.acceptedAt,
          actorId: dispatch.acceptedBy,
          payload: { dispatchId: dispatch.dispatchId },
        });
      }
    }

    const acceptedDispatches = dispatches.filter(d => d.status === 'accepted');
    const bookings: any[] = [];

    for (const dispatch of acceptedDispatches) {
      const preRes = this.getPreReservationsByDispatch(dispatch.dispatchId);
      const confirmedPreReservation = preRes.find(pr => pr.status === 'confirmed');

      if (confirmedPreReservation) {
        const relatedBookings = Array.from((this.state?.serviceBookings ?? this.facade.services.getServiceBookingsMap()).values())
          .filter(b =>
            b.offeringId === confirmedPreReservation.offeringId &&
            b.date === confirmedPreReservation.date &&
            b.time === confirmedPreReservation.time
          );
        bookings.push(...relatedBookings);
      }
    }

    for (const booking of bookings) {
      if (booking.status === 'confirmed' && booking.confirmedAt) {
        timeline.push({
          type: 'service_booking_confirmed',
          timestamp: booking.confirmedAt,
          payload: { booking_id: booking.booking_id, date: booking.date, time: booking.time },
        });
      }
    }

    const serviceOrdersMap = this.state?.serviceOrders ?? this.facade.services.getServiceOrdersMap();
    const serviceOrders = Array.from(serviceOrdersMap.values())
      .filter(so => {
        const relatedBooking = bookings.find(b => b.booking_id === so.bookingId);
        return !!relatedBooking;
      });

    for (const serviceOrder of serviceOrders) {
      const parentOrder = this.facade.ordersModule.getOrder(serviceOrder.orderId);

      if (parentOrder) {
        timeline.push({
          type: 'order_created',
          timestamp: (parentOrder.createdAt ?? new Date().toISOString()) as string,
          payload: { orderId: parentOrder.orderId, totalCents: parentOrder.totalCents },
        });

        const checkout = this.facade.ordersModule.getCheckoutByOrderId(parentOrder.orderId);

        if (checkout && checkout.status === 'paid') {
          timeline.push({
            type: 'order_paid',
            timestamp: (checkout.paidAt ?? checkout.createdAt ?? new Date().toISOString()) as string,
            payload: { checkoutId: checkout.checkoutId, orderId: parentOrder.orderId },
          });
        }
      }
    }

    if (request.status === 'expired' && request.expiredAt) {
      timeline.push({
        type: 'service_request_expired',
        timestamp: request.expiredAt,
        payload: { requestId: requestId },
      });
    }

    if (request.status === 'completed' && (request as any).completedAt) {
      timeline.push({
        type: 'service_completed',
        timestamp: (request as any).completedAt,
        payload: { requestId: requestId },
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }

  /**
   * Buscar status atual de um ServiceRequest
   */
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
    const request = this.getServiceRequest(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    let currentStatus: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';

    if (request.status === 'expired') {
      currentStatus = 'expired';
    } else if (request.status === 'completed') {
      currentStatus = 'completed';
    } else if (request.status === 'accepted') {
      const acceptedDispatch = this.getAcceptedDispatchByRequestId(requestId);

      if (acceptedDispatch && acceptedDispatch.acceptedBy) {
        const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
        const confirmedPreReservation = preReservations.find(pr =>
          pr.providerActorId === acceptedDispatch.acceptedBy && pr.status === 'confirmed'
        );

        if (confirmedPreReservation) {
          const confirmedBooking = Array.from((this.state?.serviceBookings ?? this.facade.services.getServiceBookingsMap()).values())
            .find(b =>
              b.offeringId === confirmedPreReservation.offeringId &&
              b.date === confirmedPreReservation.date &&
              b.time === confirmedPreReservation.time &&
              b.status === 'confirmed'
            );

          if (confirmedBooking) {
            const serviceOrder = Array.from((this.state?.serviceOrders ?? this.facade.services.getServiceOrdersMap()).values())
              .find(so => so.bookingId === confirmedBooking.booking_id);

            if (serviceOrder) {
              const parentOrder = this.facade.ordersModule.getOrder(serviceOrder.orderId);

              if (parentOrder) {
                const checkout = this.facade.ordersModule.getCheckoutByOrderId(parentOrder.orderId);

                if (checkout && checkout.status === 'paid') {
                  const latestRequest = this.getServiceRequest(requestId);
                  if (latestRequest?.status === 'completed') {
                    currentStatus = 'completed';
                  } else {
                    currentStatus = 'in_progress';
                  }
                } else {
                  currentStatus = 'confirmed';
                }
              } else {
                currentStatus = 'confirmed';
              }
            } else {
              currentStatus = 'confirmed';
            }
          } else {
            currentStatus = 'confirmed';
          }
        } else {
          currentStatus = 'confirmed';
        }
      } else {
        currentStatus = 'confirmed';
      }
    } else if (request.status === 'dispatched') {
      currentStatus = 'waiting_provider';
    } else if (request.status === 'open') {
      currentStatus = 'searching';
    } else {
      currentStatus = 'searching';
    }

    let provider: { providerActorId: string; confirmedAt: string } | undefined;
    const acceptedDispatch = this.getAcceptedDispatchByRequestId(requestId);

    if (acceptedDispatch && acceptedDispatch.acceptedBy && acceptedDispatch.acceptedAt) {
      provider = {
        providerActorId: acceptedDispatch.acceptedBy,
        confirmedAt: acceptedDispatch.acceptedAt,
      };
    }

    let confirmedSchedule: { date: string; time: string } | undefined;
    if (acceptedDispatch && acceptedDispatch.acceptedBy) {
      const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
      const confirmedPreReservation = preReservations.find(pr =>
        pr.providerActorId === acceptedDispatch.acceptedBy && pr.status === 'confirmed'
      );

      if (confirmedPreReservation) {
        confirmedSchedule = {
          date: confirmedPreReservation.date,
          time: confirmedPreReservation.time,
        };
      }
    }

    const intent: 'now' | 'scheduled' | 'bundle' = request.intent === 'now' || request.intent === 'scheduled' || request.intent === 'bundle' ? request.intent : 'now';

    return {
      requestId: requestId,
      status: currentStatus,
      intent,
      provider,
      confirmed_schedule: confirmedSchedule,
      serviceItems: request.serviceItems,
      city: request.city,
      neighborhood: request.neighborhood,
    };
  }
}