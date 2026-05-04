// backend/src/modules/marketplace/marketplace.service.services.ts
// Módulo Services: Bloco A (Booking+Order) + Bloco B (Fluxo Demanda) + Bloco F (Quote+Conclusão) + Bloco D (Timeline+Status)

import type { MarketplaceService } from './marketplace.service';
import type {
  Order,
  ServiceOrder,
  ServiceQuote,
  ServiceVisit,
  ServiceRequest,
  ServiceDispatch,
  ServicePreReservation,
  ServiceResource,
  CapacityEvent,
  CompanyCapacityMetrics,
  ResourceCapacityMetrics,
  RegionalCapacityMetric,
  SLARiskLevel,
  RegionalCapacityStatus,
  BottleneckCause,
  RealOperationMetrics,
  ServiceMarginAnalysis,
  OperationalCostProfile,
  ServiceGovernanceMetrics,
} from '@contracts/marketplace';
import { marketplaceLogger } from './marketplace.logger';
import { economicIdentityService } from './economic-identity.service';
import type { MarketplaceStateAdapter } from './state/marketplace-state.adapter';

type ServiceBookingInternal = {
  booking_id: string;
  offeringId: string;
  user_id: string;
  date: string;
  time: string;
  quantity: number;
  status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
  createdAt: string;
};

/** Deps opcionais quando o módulo é usado fora da facade (evita compatibility layer na facade). */
export interface IMarketplaceServicesModuleDeps {
  getServiceVisitsMap(): Map<string, ServiceVisit>;
  getServiceQuotesMap(): Map<string, ServiceQuote>;
  getUserRequestHistoryMap(): Map<string, Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>>;
  getServiceOfferingsEntries(): [string, { offering_id: string; storeId: string; templateId: string; price: { amountCents: number; currency: string }; duration_minutes?: number; recurrence?: 'weekly' | 'monthly'; isActive: boolean }][];
  getServiceOfferingsAll(): { offering_id: string; storeId: string; templateId: string; price: { amountCents: number; currency: string }; duration_minutes?: number; recurrence?: 'weekly' | 'monthly'; isActive: boolean }[];
  getCapacityEventsMap(): Map<string, CapacityEvent>;
  getRegionalCapacityMetricsMap(): Map<string, RegionalCapacityMetric>;
  getServiceGovernanceMetricsMap?(): Map<string, ServiceGovernanceMetrics>;
  setServiceResource(resourceId: string, resource: ServiceResource): void;
  setResourceCapacityMetrics(resourceId: string, metrics: ResourceCapacityMetrics): void;
  setCompanyCapacityMetrics(storeId: string, metrics: CompanyCapacityMetrics): void;
  recordCapacityEvent(event: Omit<CapacityEvent, 'eventId' | 'createdAt' | 'immutable'>): void;
  triggerEconomicEvent(event: unknown): void;
}

export class MarketplaceServicesModule {
  constructor(
    private readonly facade: MarketplaceService,
    private readonly deps?: IMarketplaceServicesModuleDeps,
    private readonly state?: MarketplaceStateAdapter
  ) {}

  private get serviceVisitsMap(): Map<string, ServiceVisit> {
    return this.state?.serviceVisits ?? this.deps?.getServiceVisitsMap?.() ?? new Map();
  }
  private get serviceQuotesMap(): Map<string, ServiceQuote> {
    return this.state?.serviceQuotes ?? this.deps?.getServiceQuotesMap?.() ?? new Map();
  }
  /** Prefer state adapter; fallback to facade. */
  private get bookingsMap(): Map<string, ServiceBookingInternal> {
    const raw = this.state?.serviceBookings ?? this.facade.services.getServiceBookingsMap();
    return raw as Map<string, ServiceBookingInternal>;
  }
  private get ordersMap(): Map<string, ServiceOrder> {
    return this.state?.serviceOrders ?? this.facade.services.getServiceOrdersMap();
  }
  private get requestsMap(): Map<string, ServiceRequest> {
    return this.state?.serviceRequests ?? this.facade.dispatch.getServiceRequestsMap();
  }
  private get dispatchesMap(): Map<string, ServiceDispatch> {
    return this.state?.serviceDispatches ?? this.facade.dispatch.getServiceDispatchesMap();
  }
  private get preReservationsMap(): Map<string, ServicePreReservation> {
    return this.state?.preReservations ?? this.facade.dispatch.getServicePreReservationsMap();
  }
  private get userRequestHistoryMap(): Map<string, Array<{ requestId: string; serviceItems: Array<{ offeringId: string; quantity: number }>; createdAt: string }>> {
    return this.deps?.getUserRequestHistoryMap?.() ?? new Map();
  }
  private get serviceOfferingsEntries(): [string, { offering_id: string; storeId: string; templateId: string; price: { amountCents: number; currency: string }; duration_minutes?: number; recurrence?: 'weekly' | 'monthly'; isActive: boolean }][] {
    return this.deps?.getServiceOfferingsEntries?.() ?? [];
  }
  private get serviceOfferingsAll(): { offering_id: string; storeId: string; templateId: string; price: { amountCents: number; currency: string }; duration_minutes?: number; recurrence?: 'weekly' | 'monthly'; isActive: boolean }[] {
    return this.deps?.getServiceOfferingsAll?.() ?? [];
  }
  private get capacityEventsMap(): Map<string, CapacityEvent> {
    return this.deps?.getCapacityEventsMap?.() ?? new Map();
  }
  private get regionalCapacityMetricsMap(): Map<string, RegionalCapacityMetric> {
    return this.deps?.getRegionalCapacityMetricsMap?.() ?? new Map();
  }
  private get serviceGovernanceMetricsMap(): Map<string, ServiceGovernanceMetrics> {
    return this.deps?.getServiceGovernanceMetricsMap?.() ?? new Map();
  }

  private delegateTriggerEconomicEvent(event: unknown): void {
    this.deps?.triggerEconomicEvent?.(event);
  }
  private delegateSetServiceResource(resourceId: string, resource: ServiceResource): void {
    this.deps?.setServiceResource?.(resourceId, resource);
  }
  private delegateSetResourceCapacityMetrics(resourceId: string, metrics: ResourceCapacityMetrics): void {
    this.deps?.setResourceCapacityMetrics?.(resourceId, metrics);
  }
  private delegateSetCompanyCapacityMetrics(storeId: string, metrics: CompanyCapacityMetrics): void {
    this.deps?.setCompanyCapacityMetrics?.(storeId, metrics);
  }
  private delegateRecordCapacityEvent(event: Omit<CapacityEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    this.deps?.recordCapacityEvent?.(event);
  }

  createServiceBooking(input: {
    offeringId: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    quantity: number;
  }): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
    createdAt: string;
  } {
    const offering = this.facade.services.getServiceOfferingInternal(input.offeringId);
    if (!offering || !offering.isActive) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    const availability = this.facade.services.getServiceAvailability(input.offeringId);
    const dateObj = new Date(input.date);
    const weekday = dateObj.getDay();

    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) {
      throw new Error('Horário não disponível para este dia');
    }

    const requestedTime = input.time;
    if (requestedTime < slot.starts_at || requestedTime >= slot.ends_at) {
      throw new Error('Horário fora do período disponível');
    }

    const serviceBookings = this.bookingsMap;
    const existingBookings = Array.from(serviceBookings.values())
      .filter(b =>
        b.offeringId === input.offeringId &&
        b.date === input.date &&
        b.time === input.time &&
        b.status !== 'cancelled'
      );

    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);
    if (totalBooked + input.quantity > slot.capacity) {
      throw new Error(`Capacidade insuficiente. Disponível: ${slot.capacity - totalBooked}, solicitado: ${input.quantity}`);
    }

    const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const booking: ServiceBookingInternal = {
      booking_id: bookingId,
      offeringId: input.offeringId,
      user_id: input.user_id,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      status: 'reserved',
      createdAt: new Date().toISOString(),
    };

    serviceBookings.set(bookingId, booking);
    return booking;
  }

  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: {
      amountCents: number;
      currency: string;
    };
  } {
    const serviceBookings = this.bookingsMap;
    const booking = serviceBookings.get(bookingId);
    if (!booking) {
      throw new Error('Reserva não encontrada');
    }

    if (booking.status !== 'reserved') {
      throw new Error('Reserva já foi confirmada ou cancelada');
    }

    const offering = this.facade.services.getServiceOfferingInternal(booking.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    const unitCents = 'amountCents' in offering.price ? offering.price.amountCents : Math.round((offering.price as { amount: number }).amount * 100);
    const totalPriceCents = unitCents * booking.quantity;

    const orderId = `service-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceOrder: ServiceOrder = {
      orderId,
      bookingId,
      offeringId: booking.offeringId,
      price: {
        amountCents: totalPriceCents,
        currency: offering.price.currency,
      },
      channel: 'online',
      createdAt: new Date().toISOString(),
    };

    const serviceOrders = this.ordersMap;
    serviceOrders.set(orderId, serviceOrder);

    (booking as ServiceBookingInternal).status = 'confirmed';
    serviceBookings.set(bookingId, booking);

    return {
      bookingId,
      orderId,
      offeringId: booking.offeringId,
      price: serviceOrder.price,
    };
  }

  getServiceBooking(bookingId: string): ServiceBookingInternal | null {
    return this.bookingsMap.get(bookingId) || null;
  }

  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return Array.from(this.ordersMap.values()).find(o => o.bookingId === bookingId) || null;
  }

  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.ordersMap.get(orderId) || null;
  }

  addServiceOrderToOrder(orderId: string, serviceOrderId: string): {
    orderId: string;
    storeId: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: Array<{
      productId: string;
      name: string;
      price: {
        amountCents: number;
        currency: string;
      };
      quantity: number;
      subtotal: number;
    }>;
    totalCents: number;
  } {
    const order = this.facade.orders.getOrder(orderId);
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const serviceOrders = this.ordersMap;
    const serviceOrder = serviceOrders.get(serviceOrderId);
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    const offering = this.facade.services.getServiceOfferingInternal(serviceOrder.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    const template = this.facade.services.getServiceTemplates().templates.find(t => t.templateId === offering.templateId);
    const serviceName = template?.name || 'Serviço';

    const serviceBookings = this.bookingsMap;
    const booking = serviceBookings.get(serviceOrder.bookingId);
    const quantity = booking?.quantity || 1;

    const subtotal = serviceOrder.price.amountCents * quantity;

    order.items.push({
      productId: `service-${serviceOrder.offeringId}`,
      name: serviceName,
      price: serviceOrder.price,
      quantity,
      subtotal,
    });

    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);

    this.facade.orders.updateOrder(orderId, order);

    return {
      orderId: order.orderId,
      storeId: order.storeId,
      channel: order.channel,
      origin: order.origin,
      items: order.items,
      totalCents: order.totalCents,
    };
  }

  // ---------- Bloco F: Quote + Conclusão ----------

  confirmServiceCompletedByCustomer(requestId: string, customerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.requestsMap.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }
    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode confirmar');
    }
    const hold = this.facade.payments.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }
    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }
    this.facade.payments.createServiceCompletionSignal(requestId, customerActorId, 'customer', 'confirm_completed');
    return this.facade.payments.releaseServicePaymentHoldPublic(hold.holdId, customerActorId);
  }

  confirmServiceCompletedByProvider(requestId: string, providerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.requestsMap.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }
    const acceptedDispatch = Array.from(this.dispatchesMap.values())
      .find(d => d.requestId === requestId && d.status === 'accepted');
    if (!acceptedDispatch || acceptedDispatch.acceptedBy !== providerActorId) {
      throw new Error('Apenas o provider que aceitou o serviço pode confirmar');
    }
    const hold = this.facade.payments.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }
    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }
    this.facade.payments.createServiceCompletionSignal(requestId, providerActorId, 'provider', 'confirm_completed');
    if (hold.releasePolicy === 'provider_confirm_with_proof') {
      return this.facade.payments.releaseServicePaymentHoldPublic(hold.holdId, providerActorId);
    }
    throw new Error('Provider não pode liberar pagamento diretamente nesta política');
  }

  completeServiceRequest(requestId: string, completedBy: string): {
    requestId: string;
    completedAt: string;
    status: 'completed';
  } {
    const serviceRequests = this.requestsMap;
    const request = serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }
    if (request.status !== 'accepted') {
      throw new Error('Serviço não pode ser marcado como completo (não foi aceito)');
    }
    const acceptedDispatch = Array.from(this.dispatchesMap.values())
      .find(d => d.requestId === requestId && d.status === 'accepted');
    if (!acceptedDispatch || !acceptedDispatch.acceptedBy) {
      throw new Error('Nenhum provider aceito encontrado para este serviço');
    }
    if (completedBy !== acceptedDispatch.acceptedBy) {
      throw new Error('Apenas o provider que aceitou pode marcar como completo');
    }
    const completedAt = new Date().toISOString();
    (request as ServiceRequest & { completedAt?: string }).completedAt = completedAt;
    serviceRequests.set(requestId, request);
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `completed-${requestId}-${Date.now()}`,
        type: 'service_completed',
        region: { country: 'BR', state: 'PR', city: request.city },
        actorId: completedBy,
        actorType: 'service_provider',
        referenceId: requestId,
        amountCents: 0,
        visibility: 'local',
        displayText: 'Serviço concluído',
        createdAt: completedAt,
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('Serviço marcado como completo', {
      requestId: requestId,
      providerActorId: completedBy,
      completedAt: completedAt,
    });
    return { requestId, completedAt, status: 'completed' };
  }

  createServiceQuote(input: {
    requestId: string;
    visitId: string;
    providerActorId: string;
    serviceValue: { amountCents: number; currency: string };
    description: string;
    requiresMaterials: boolean;
    executionDate?: string;
    executionTime?: string;
  }): ServiceQuote {
    const serviceVisits = this.serviceVisitsMap;
    const visit = serviceVisits.get(input.visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }
    if (visit.status !== 'visit_completed') {
      throw new Error('Visita precisa estar completa para enviar orçamento');
    }
    if (visit.providerActorId !== input.providerActorId) {
      throw new Error('Apenas o provider que realizou a visita pode enviar orçamento');
    }
    const serviceQuotes = this.serviceQuotesMap;
    const existingQuote = Array.from(serviceQuotes.values())
      .find(q => q.visitId === input.visitId && q.status === 'pending');
    if (existingQuote) {
      throw new Error('Já existe um orçamento pendente para esta visita');
    }
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const quote: ServiceQuote = {
      quoteId,
      requestId: input.requestId,
      visitId: input.visitId,
      providerActorId: input.providerActorId,
      serviceValue: input.serviceValue,
      description: input.description,
      requiresMaterials: input.requiresMaterials,
      executionDate: input.executionDate,
      executionTime: input.executionTime,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    serviceQuotes.set(quoteId, quote);
    this.facade.compliance.calculateServiceGovernanceMetrics(
      input.providerActorId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `quote-${quoteId}`,
        type: 'service_request_created',
        region: { country: 'BR', state: 'PR', city: 'Curitiba' },
        actorId: input.providerActorId,
        actorType: 'service_provider',
        referenceId: quoteId,
        amountCents: input.serviceValue.amountCents,
        currency: input.serviceValue.currency,
        visibility: 'local',
        displayText: 'Orçamento enviado',
        createdAt: quote.createdAt,
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('ServiceQuote criado', {
      quoteId,
      requestId: input.requestId,
      visitId: input.visitId,
      serviceValue: input.serviceValue,
    });
    return quote;
  }

  async acceptServiceQuote(quoteId: string, customerActorId: string): Promise<{
    quoteId: string;
    bookingId: string;
    orderId: string;
    paymentHoldId: string;
  }> {
    const serviceQuotes = this.serviceQuotesMap;
    const quote = serviceQuotes.get(quoteId);
    if (!quote) {
      throw new Error('Orçamento não encontrado');
    }
    if (quote.status !== 'pending') {
      throw new Error(`Orçamento não está em status 'pending' (status atual: ${quote.status})`);
    }
    const request = this.requestsMap.get(quote.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }
    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode aceitar o orçamento');
    }
    const visit = this.serviceVisitsMap.get(quote.visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }
    const booking = this.facade.services.createServiceBooking({
      offeringId: request.serviceItems[0].offeringId,
      user_id: customerActorId,
      date: quote.executionDate || visit.scheduledDate,
      time: quote.executionTime || visit.scheduledTime,
      quantity: request.serviceItems[0].quantity,
    });
    const confirmed = this.facade.services.confirmServiceBooking(booking.booking_id);
    const order = this.facade.orders.createOrder(quote.providerActorId);
    await this.facade.orders.addOrderItem(order.orderId, confirmed.orderId, 1);
    const checkout = this.facade.checkout.createCheckoutFromOrder(order.orderId);
    this.facade.checkout.confirmCheckout(checkout.checkoutId);
    const paymentPlan = this.facade.checkout.createPaymentPlan(checkout.checkoutId, 'balance');
    (quote as ServiceQuote & { status: string; acceptedAt?: string; bookingId?: string; orderId?: string }).status = 'accepted';
    (quote as ServiceQuote & { acceptedAt: string }).acceptedAt = new Date().toISOString();
    (quote as ServiceQuote & { bookingId: string }).bookingId = booking.booking_id;
    (quote as ServiceQuote & { orderId: string }).orderId = order.orderId;
    serviceQuotes.set(quoteId, quote);
    this.facade.compliance.calculateServiceGovernanceMetrics(
      quote.providerActorId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `quote-accepted-${quoteId}`,
        type: 'service_request_created',
        region: { country: 'BR', state: 'PR', city: request.city },
        actorId: customerActorId,
        actorType: 'user',
        referenceId: quoteId,
        amountCents: 0,
        visibility: 'local',
        displayText: 'Orçamento aceito',
        createdAt: new Date().toISOString(),
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    const hold = this.facade.payments.getServicePaymentHoldByRequest(quote.requestId);
    marketplaceLogger.init('ServiceQuote aceito', {
      quoteId,
      bookingId: booking.booking_id,
      orderId: order.orderId,
      paymentPlanId: paymentPlan.paymentPlanId,
    });
    return {
      quoteId,
      bookingId: booking.booking_id,
      orderId: order.orderId,
      paymentHoldId: hold?.holdId ?? '',
    };
  }

  declineServiceQuote(quoteId: string, customerActorId: string): ServiceQuote {
    const serviceQuotes = this.serviceQuotesMap;
    const quote = serviceQuotes.get(quoteId);
    if (!quote) {
      throw new Error('Orçamento não encontrado');
    }
    if (quote.status !== 'pending') {
      throw new Error(`Orçamento não está em status 'pending' (status atual: ${quote.status})`);
    }
    const request = this.requestsMap.get(quote.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }
    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode recusar o orçamento');
    }
    (quote as ServiceQuote & { status: string; declinedAt?: string }).status = 'declined';
    (quote as ServiceQuote & { declinedAt: string }).declinedAt = new Date().toISOString();
    serviceQuotes.set(quoteId, quote);
    this.facade.compliance.calculateServiceGovernanceMetrics(
      quote.providerActorId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `quote-declined-${quoteId}`,
        type: 'service_request_created',
        region: { country: 'BR', state: 'PR', city: request.city },
        actorId: customerActorId,
        actorType: 'user',
        referenceId: quoteId,
        amountCents: 0,
        visibility: 'restricted',
        displayText: 'Orçamento recusado',
        createdAt: new Date().toISOString(),
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('ServiceQuote recusado', { quoteId });
    return quote;
  }

  // ---------- Bloco D: Timeline + Status ----------

  getServiceRequestTimeline(requestId: string): Array<{
    type: string;
    timestamp: string;
    actor_id?: string;
    payload?: unknown;
  }> {
    const serviceRequests = this.requestsMap;
    const request = serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const timeline: Array<{
      type: string;
      timestamp: string;
      actorId?: string;
      payload?: unknown;
    }> = [];

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

    const serviceDispatches = this.dispatchesMap;
    const dispatches = Array.from(serviceDispatches.values())
      .filter(d => d.requestId === requestId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const dispatch of dispatches) {
      timeline.push({
        type: 'service_dispatch_sent',
        timestamp: dispatch.createdAt,
        payload: {
          dispatchId: dispatch.dispatchId,
          candidates_count: dispatch.candidates.length,
          candidates: dispatch.candidates.map(c => ({
            providerActorId: c.providerActorId,
            offeringId: c.offeringId,
          })),
        },
      });

      const preReservations = this.facade.dispatch.getPreReservationsByDispatch(dispatch.dispatchId);
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
    const bookings: Array<ServiceBookingInternal & { confirmedAt?: string }> = [];
    const serviceBookings = this.bookingsMap;

    for (const dispatch of acceptedDispatches) {
      const preReservations = this.facade.dispatch.getPreReservationsByDispatch(dispatch.dispatchId);
      const confirmedPreReservation = preReservations.find(pr => pr.status === 'confirmed');
      if (confirmedPreReservation) {
        const relatedBookings = Array.from(serviceBookings.values())
          .filter(b =>
            b.offeringId === confirmedPreReservation.offeringId &&
            b.date === confirmedPreReservation.date &&
            b.time === confirmedPreReservation.time
          );
        bookings.push(...(relatedBookings as Array<ServiceBookingInternal & { confirmedAt?: string }>));
      }
    }

    for (const booking of bookings) {
      if (booking.status === 'confirmed' && (booking as ServiceBookingInternal & { confirmedAt?: string }).confirmedAt) {
        timeline.push({
          type: 'service_booking_confirmed',
          timestamp: (booking as ServiceBookingInternal & { confirmedAt?: string }).confirmedAt!,
          payload: {
            booking_id: booking.booking_id,
            date: booking.date,
            time: booking.time,
          },
        });
      }
    }

    const serviceOrders = this.ordersMap;
    const serviceOrdersList = Array.from(serviceOrders.values()).filter(so => {
      const relatedBooking = bookings.find(b => b.booking_id === so.bookingId);
      return !!relatedBooking;
    });

    for (const serviceOrder of serviceOrdersList) {
      const parentOrder = this.facade.orders.getOrder(serviceOrder.orderId);
      if (parentOrder) {
        const orderCreatedAt = (parentOrder as Order & { createdAt?: Date | string }).createdAt;
        const orderTs = (orderCreatedAt as unknown) instanceof Date ? (orderCreatedAt as Date).toISOString() : (orderCreatedAt ?? '');
        timeline.push({
          type: 'order_created',
          timestamp: orderTs,
          payload: {
            orderId: parentOrder.orderId,
            totalCents: parentOrder.totalCents,
          },
        });

        const checkouts = this.facade.checkout.listCheckouts();
        const checkout = checkouts.find(c => this.facade.checkout.getCheckoutOrderId(c.checkoutId) === parentOrder.orderId);
        if (checkout && checkout.status === 'paid') {
          const paidOrCreated = (checkout as { paidAt?: Date | string; createdAt?: Date | string }).paidAt ?? (checkout as { createdAt?: Date | string }).createdAt;
          const paidTs: string = (paidOrCreated as unknown) instanceof Date ? (paidOrCreated as Date).toISOString() : (typeof paidOrCreated === 'string' ? paidOrCreated : '');
          timeline.push({
            type: 'order_paid',
            timestamp: paidTs,
            payload: {
              checkoutId: checkout.checkoutId,
              orderId: parentOrder.orderId,
            },
          });
        }
      }
    }

    const requestWithMeta = request as ServiceRequest & { expiredAt?: string; completedAt?: string };
    if (request.status === 'expired' && requestWithMeta.expiredAt) {
      timeline.push({
        type: 'service_request_expired',
        timestamp: requestWithMeta.expiredAt,
        payload: { requestId: requestId },
      });
    }
    if (request.status === 'accepted' && requestWithMeta.completedAt) {
      timeline.push({
        type: 'service_completed',
        timestamp: requestWithMeta.completedAt,
        payload: { requestId: requestId },
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return timeline;
  }

  getServiceRequestStatus(requestId: string): {
    requestId: string;
    status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
    intent: 'now' | 'scheduled' | 'bundle';
    provider?: {
      providerActorId: string;
      confirmedAt: string;
    };
    confirmed_schedule?: {
      date: string;
      time: string;
    };
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    city: string;
    neighborhood?: string;
  } {
    const serviceRequests = this.requestsMap;
    const request = serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const requestWithMeta = request as ServiceRequest & { completedAt?: string };
    let currentStatus: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';

    if (request.status === 'expired') {
      currentStatus = 'expired';
    } else if (request.status === 'accepted') {
      currentStatus = requestWithMeta.completedAt ? 'completed' : 'in_progress';
      const serviceDispatches = this.dispatchesMap;
      const acceptedDispatch = Array.from(serviceDispatches.values())
        .find(d => d.requestId === requestId && d.status === 'accepted');

      if (acceptedDispatch && acceptedDispatch.acceptedBy) {
        const preReservations = this.facade.dispatch.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
        const confirmedPreReservation = preReservations.find(pr =>
          pr.providerActorId === acceptedDispatch.acceptedBy && pr.status === 'confirmed'
        );

        if (confirmedPreReservation) {
          const serviceBookings = this.bookingsMap;
          const confirmedBooking = Array.from(serviceBookings.values()).find(b =>
            b.offeringId === confirmedPreReservation.offeringId &&
            b.date === confirmedPreReservation.date &&
            b.time === confirmedPreReservation.time &&
            b.status === 'confirmed'
          );

          if (confirmedBooking) {
            const serviceOrders = this.ordersMap;
            const serviceOrder = Array.from(serviceOrders.values()).find(
              so => so.bookingId === confirmedBooking.booking_id
            );

            if (serviceOrder) {
              const parentOrder = this.facade.orders.getOrder(serviceOrder.orderId);
              if (parentOrder) {
                const checkouts = this.facade.checkout.listCheckouts();
                const checkout = checkouts.find(
                  c => this.facade.checkout.getCheckoutOrderId(c.checkoutId) === parentOrder.orderId
                );
                if (checkout && checkout.status === 'paid') {
                  currentStatus = requestWithMeta.completedAt ? 'completed' : 'in_progress';
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

    const serviceDispatches = this.dispatchesMap;
    const acceptedDispatch = Array.from(serviceDispatches.values()).find(
      d => d.requestId === requestId && d.status === 'accepted'
    );

    let provider: { providerActorId: string; confirmedAt: string } | undefined;
    if (acceptedDispatch && acceptedDispatch.acceptedBy && acceptedDispatch.acceptedAt) {
      provider = {
        providerActorId: acceptedDispatch.acceptedBy,
        confirmedAt: acceptedDispatch.acceptedAt,
      };
    }

    let confirmedSchedule: { date: string; time: string } | undefined;
    if (acceptedDispatch && acceptedDispatch.acceptedBy) {
      const preReservations = this.facade.dispatch.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
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

    const intent: 'now' | 'scheduled' | 'bundle' =
      request.intent === 'now' || request.intent === 'scheduled' || request.intent === 'bundle'
        ? request.intent
        : 'now';

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

  // ---------- Bloco B: Fluxo de Demanda ----------

  private checkAntiSpam(requesterActorId: string, serviceItems: Array<{ offeringId: string; quantity: number }>): boolean {
    const userHistory = this.userRequestHistoryMap.get(requesterActorId) || [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentDuplicate = userHistory.find(req => {
      if (new Date(req.createdAt) < fiveMinutesAgo) return false;
      if (req.serviceItems.length !== serviceItems.length) return false;
      return req.serviceItems.every(item1 =>
        serviceItems.some(item2 => item1.offeringId === item2.offeringId && item1.quantity === item2.quantity)
      );
    });
    return !recentDuplicate;
  }

  private checkProviderAbuse(providerActorId: string): boolean {
    const slaMetrics = this.facade.dispatch.getProviderResponseSLAMetrics(providerActorId);
    if (!slaMetrics) return true;
    if (slaMetrics.totalDispatchesReceived > 10 && slaMetrics.acceptanceRate < 30) return false;
    return true;
  }

  private isSlotAvailable(offeringId: string, date: string, time: string, quantity: number): boolean {
    const availability = this.facade.services.getServiceAvailability(offeringId);
    if (!availability || availability.length === 0) return false;
    const dateObj = new Date(date);
    const weekday = dateObj.getDay();
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) return false;
    if (time < slot.starts_at || time >= slot.ends_at) return false;
    const serviceBookings = this.bookingsMap;
    const existingBookings = Array.from(serviceBookings.values()).filter(b =>
      b.offeringId === offeringId && b.date === date && b.time === time && b.status !== 'cancelled'
    );
    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);
    const servicePreReservations = this.preReservationsMap;
    const activePreReservations = Array.from(servicePreReservations.values()).filter(pr =>
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

  private sortCandidatesDeterministically(
    candidates: Array<{ providerActorId: string; offeringId: string; eligibilityReason: string; reputation_score?: number }>,
    request: ServiceRequest
  ): Array<{ providerActorId: string; offeringId: string; eligibilityReason: string; reputation_score?: number; sort_score: number }> {
    return candidates
      .map(candidate => {
        const presence = this.facade.dispatch.getProviderPresence(candidate.providerActorId);
        const governancePriority = this.facade.orchestration.calculateMatchingPriority(candidate.providerActorId);
        const slaMetrics = this.facade.dispatch.getProviderResponseSLAMetrics(candidate.providerActorId);
        let sortScore = 1;
        if (request.constraints.providerRadiusMode === 'same_neighborhood') sortScore += 2;
        else sortScore += 1;
        if (slaMetrics) {
          sortScore += Math.max(0, 10 - slaMetrics.averageResponseTimeMinutes / 6);
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

  private createPreReservation(input: {
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
    this.preReservationsMap.set(preReservationId, preReservation);
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `pre-${preReservationId}`,
        type: 'service_pre_reservation_created',
        region: { country: 'BR', state: 'PR', city: 'Curitiba' },
        actorId: input.providerActorId,
        actorType: 'service_provider',
        referenceId: preReservationId,
        amountCents: 0,
        visibility: 'restricted',
        displayText: 'Pré-reserva criada',
        createdAt: preReservation.createdAt,
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('Pré-reserva criada', { preReservationId, dispatchId: input.dispatchId, providerActorId: input.providerActorId });
    return preReservation;
  }

  private confirmPreReservation(preReservationId: string): { booking_id: string; preReservationId: string } {
    const servicePreReservations = this.preReservationsMap;
    const preReservation = servicePreReservations.get(preReservationId);
    if (!preReservation) throw new Error('Pré-reserva não encontrada');
    if (preReservation.status !== 'active') throw new Error('Pré-reserva não está ativa');
    if (new Date(preReservation.expiresAt) < new Date()) throw new Error('Pré-reserva expirada');
    const request = this.requestsMap.get(preReservation.requestId);
    if (!request) throw new Error('Requisição não encontrada');
    const booking = this.facade.services.createServiceBooking({
      offeringId: preReservation.offeringId,
      user_id: request.requesterActorId,
      date: preReservation.date,
      time: preReservation.time,
      quantity: preReservation.quantity,
    });
    (preReservation as ServicePreReservation & { status: string; confirmedAt?: string }).status = 'confirmed';
    (preReservation as ServicePreReservation & { confirmedAt: string }).confirmedAt = new Date().toISOString();
    servicePreReservations.set(preReservationId, preReservation);
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `pre-confirmed-${preReservationId}`,
        type: 'service_pre_reservation_confirmed',
        region: { country: 'BR', state: 'PR', city: 'Curitiba' },
        actorId: preReservation.providerActorId,
        actorType: 'service_provider',
        referenceId: preReservationId,
        amountCents: 0,
        visibility: 'restricted',
        displayText: 'Pré-reserva confirmada',
        createdAt: new Date().toISOString(),
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('Pré-reserva confirmada', { preReservationId, booking_id: booking.booking_id });
    return { booking_id: booking.booking_id, preReservationId };
  }

  private createPreReservationsForDispatch(dispatchId: string, request: ServiceRequest): ServicePreReservation[] {
    const serviceDispatches = this.dispatchesMap;
    const dispatch = serviceDispatches.get(dispatchId);
    if (!dispatch) throw new Error('Dispatch não encontrado');
    const preReservations: ServicePreReservation[] = [];
    for (const candidate of dispatch.candidates) {
      if (!this.checkProviderAbuse(candidate.providerActorId)) continue;
      const offering = this.facade.services.getServiceOfferingInternal(candidate.offeringId);
      if (!offering) continue;
      let targetDate: string;
      let targetTime: string;
      if (request.intent === 'now') {
        const now = new Date();
        targetDate = now.toISOString().split('T')[0];
        const availability = this.facade.services.getServiceAvailability(candidate.offeringId);
        const todaySlot = availability?.find(a => a.weekday === now.getDay());
        if (!todaySlot) continue;
        targetTime = todaySlot.starts_at;
      } else if (request.intent === 'scheduled' && request.schedule.date) {
        targetDate = request.schedule.date.split('T')[0];
        const availability = this.facade.services.getServiceAvailability(candidate.offeringId);
        const scheduledDate = new Date(request.schedule.date);
        const scheduledSlot = availability?.find(a => a.weekday === scheduledDate.getDay());
        if (!scheduledSlot) continue;
        targetTime = scheduledSlot.starts_at;
      } else continue;
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

  createServiceRequest(input: {
    requesterActorId: string;
    city: string;
    neighborhood?: string;
    intent: 'now' | 'scheduled' | 'bundle';
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    schedule: { mode: 'now' | 'scheduled'; maxWaitMinutes?: number; date?: string; timeWindowMinutes?: number };
    constraints: { providerRadiusMode: 'same_neighborhood' | 'same_city'; minTrustLevelRequired: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'; allowMultipleProviders: boolean };
  }): ServiceRequest {
    if (input.intent === 'scheduled' && !input.schedule.date) throw new Error('Data é obrigatória para intent=scheduled');
    if (input.intent === 'now' && !input.schedule.maxWaitMinutes) throw new Error('max_wait_minutes é obrigatório para intent=now');
    for (const item of input.serviceItems) {
      const offering = this.facade.services.getServiceOfferingInternal(item.offeringId);
      if (!offering) throw new Error(`Service offering não encontrado: ${item.offeringId}`);
      if (!offering.isActive) throw new Error(`Service offering não está ativo: ${item.offeringId}`);
      if (item.quantity <= 0) throw new Error('Quantidade deve ser maior que zero');
    }
    if (input.intent === 'scheduled' && input.schedule.date) {
      const scheduledDate = new Date(input.schedule.date);
      if (scheduledDate <= new Date()) throw new Error('Data agendada deve ser futura');
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
    this.requestsMap.set(requestId, request);
    const userHistory = this.userRequestHistoryMap.get(input.requesterActorId) || [];
    userHistory.push({ requestId, serviceItems: input.serviceItems, createdAt: new Date().toISOString() });
    this.userRequestHistoryMap.set(input.requesterActorId, userHistory);
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `req-${requestId}`,
        type: 'service_request_created',
        region: { country: 'BR', state: 'PR', city: input.city },
        actorId: input.requesterActorId,
        actorType: 'user',
        referenceId: requestId,
        amountCents: 0,
        visibility: 'restricted',
        displayText: 'Requisição criada',
        createdAt: request.createdAt,
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('Requisição de serviço criada', { requestId, intent: input.intent, items_count: input.serviceItems.length });
    return request;
  }

  expireServiceRequest(requestId: string): ServiceRequest {
    const serviceRequests = this.requestsMap;
    const request = serviceRequests.get(requestId);
    if (!request) throw new Error('Requisição não encontrada');
    if (request.status !== 'open' && request.status !== 'dispatched') {
      throw new Error('Requisição não pode ser expirada (já foi aceita, cancelada ou expirada)');
    }
    const now = new Date();
    let shouldExpire = false;
    if (request.intent === 'now' && request.schedule.maxWaitMinutes) {
      const requestAge = (now.getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      if (requestAge > request.schedule.maxWaitMinutes) shouldExpire = true;
    } else if (request.intent === 'scheduled' && request.schedule.date) {
      if (now > new Date(request.schedule.date)) shouldExpire = true;
    }
    if (!shouldExpire) throw new Error('Prazo ainda não expirou');
    (request as ServiceRequest & { status: string; expiredAt?: string }).status = 'expired';
    (request as ServiceRequest & { expiredAt: string }).expiredAt = new Date().toISOString();
    serviceRequests.set(requestId, request);
    const serviceDispatches = this.dispatchesMap;
    const activeDispatch = Array.from(serviceDispatches.values()).find(d => d.requestId === requestId && d.status === 'sent');
    if (activeDispatch) {
      (activeDispatch as ServiceDispatch & { status: string; expiredAt?: string }).status = 'expired';
      (activeDispatch as ServiceDispatch & { expiredAt: string }).expiredAt = new Date().toISOString();
      serviceDispatches.set(activeDispatch.dispatchId, activeDispatch);
    }
    try {
      this.delegateTriggerEconomicEvent({
        eventId: `expired-${requestId}`,
        type: 'service_request_created',
        region: { country: 'BR', state: 'PR', city: request.city },
        actorId: request.requesterActorId,
        actorType: 'user',
        referenceId: requestId,
        amountCents: 0,
        visibility: 'restricted',
        displayText: 'Requisição expirada',
        createdAt: new Date().toISOString(),
      } as import('@contracts/marketplace').EconomicEvent);
    } catch {
      // ignorar
    }
    marketplaceLogger.init('Requisição de serviço expirada', { requestId });
    return request;
  }

  async listEligibleServiceProviders(tenantId: string, requestId: string): Promise<Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
  }>> {
    const serviceRequests = this.requestsMap;
    const request = serviceRequests.get(requestId);
    if (!request) throw new Error('Requisição não encontrada');
    const candidates: Array<{ providerActorId: string; offeringId: string; eligibilityReason: string; reputation_score?: number }> = [];
    const entries = this.serviceOfferingsEntries;
    for (const item of request.serviceItems) {
      const offering = this.facade.services.getServiceOfferingInternal(item.offeringId);
      if (!offering) continue;
      const providersWithOffering = entries
        .filter(([offeringKey, o]) => offeringKey === item.offeringId && o.isActive)
        .map(([, o]) => o.storeId);
      for (const providerId of providersWithOffering) {
        const presence = this.facade.dispatch.getProviderPresence(providerId);
        const isOnline = presence ? presence.status === 'online' : this.facade.dispatch.getProviderOnlineStatus(providerId);
        if (!isOnline) continue;
        const availability = this.facade.services.getServiceAvailability(item.offeringId);
        if (!availability || availability.length === 0) continue;
        let availabilityMatches = false;
        if (request.intent === 'now') {
          const today = new Date();
          const todayAvailability = availability.find(a => a.weekday === today.getDay());
          if (todayAvailability && todayAvailability.capacity > 0) availabilityMatches = true;
        } else if (request.intent === 'scheduled' && request.schedule.date) {
          const scheduledDate = new Date(request.schedule.date);
          const scheduledAvailability = availability.find(a => a.weekday === scheduledDate.getDay());
          if (scheduledAvailability && scheduledAvailability.capacity > 0) availabilityMatches = true;
        }
        if (!availabilityMatches) continue;
        const identity = await economicIdentityService.getEconomicIdentity(tenantId, providerId);
        if (!identity) continue;
        const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
        const requiredLevel = trustLevels[request.constraints.minTrustLevelRequired] ?? 0;
        const providerLevel = trustLevels[identity.trustLevel] ?? 0;
        if (providerLevel < requiredLevel) continue;
        const storesData = this.facade.catalog.getStores();
        const store = storesData.stores.find(s => s.storeId === providerId);
        if (!store) continue;
        let regionMatches = false;
        if (request.constraints.providerRadiusMode === 'same_neighborhood') {
          regionMatches = store.branches.some(b => b.location?.city === request.city && b.location?.neighborhood === request.neighborhood);
        } else if (request.constraints.providerRadiusMode === 'same_city') {
          regionMatches = store.branches.some(b => b.location?.city === request.city);
        }
        if (!regionMatches) continue;
        const disputes = Array.from(this.facade.dispatch.getDisputeCasesMap().values()).filter(
          d => (d.actorInvolved as { actorId?: string }).actorId === providerId && d.status === 'open'
        );
        if (disputes.length > 0) continue;
        const offeringForResource = this.facade.services.getServiceOfferingInternal(item.offeringId);
        if (offeringForResource) {
          const targetDate = request.intent === 'now' ? new Date().toISOString().split('T')[0] : request.schedule.date?.split('T')[0] ?? null;
          const targetTime = request.intent === 'now' ? new Date().toTimeString().split(' ')[0].substring(0, 5) : '09:00';
          if (targetDate) {
            const resourceAvailability = this.facade.capacity.checkResourceAvailability(offeringForResource.templateId, providerId, targetDate, targetTime);
            if (!resourceAvailability.available) {
              this.delegateRecordCapacityEvent({
                resourceId: resourceAvailability.missing_resources[0],
                storeId: providerId,
                companyId: providerId,
                eventType: 'service_rejected_capacity',
                details: { serviceRequestId: requestId, reason: `Recursos necessários não disponíveis: ${resourceAvailability.missing_resources.join(', ')}` },
              });
              continue;
            }
            const eligibleResources = this.facade.capacity.getEligibleResourcesForMatching(providerId, offeringForResource.templateId);
            if (eligibleResources.length === 0) continue;
          }
        }
        const eligibilityReason = `Provider elegível: online, disponível, trust ${identity.trustLevel}, região compatível, capacidade disponível`;
        const snapshots = this.facade.governance.getReputationSnapshots(providerId);
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const reputationScore = latestSnapshot ? latestSnapshot.score.finalScore : undefined;
        candidates.push({ providerActorId: providerId, offeringId: item.offeringId, eligibilityReason, reputation_score: reputationScore });
      }
    }
    candidates.sort((a, b) => {
      if (a.reputation_score !== undefined && b.reputation_score !== undefined && b.reputation_score !== a.reputation_score) return b.reputation_score - a.reputation_score;
      if (a.reputation_score !== undefined) return -1;
      if (b.reputation_score !== undefined) return 1;
      return a.providerActorId.localeCompare(b.providerActorId);
    });
    return candidates;
  }

  async dispatchServiceRequest(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    const serviceRequests = this.requestsMap;
    const serviceDispatches = this.dispatchesMap;
    const request = serviceRequests.get(requestId);
    if (!request) throw new Error('Requisição não encontrada');
    if (request.status !== 'open') throw new Error('Requisição não está aberta para dispatch');
    const existingDispatch = Array.from(serviceDispatches.values()).find(
      d => d.requestId === requestId && (d.status === 'sent' || d.status === 'accepted')
    );
    if (existingDispatch) {
      const dispatchAge = Date.now() - new Date(existingDispatch.createdAt).getTime();
      if (dispatchAge < 10 * 60 * 1000) throw new Error('Já existe dispatch ativo para esta requisição (aguarde 10 minutos)');
    }
    const candidates = await this.listEligibleServiceProviders(tenantId, requestId);
    if (candidates.length === 0) throw new Error('Nenhum provider elegível encontrado');
    const sortedCandidates = this.sortCandidatesDeterministically(candidates, request);
    const limitedCandidates = sortedCandidates.slice(0, 20);
    const dispatchId = `service-dispatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dispatch: ServiceDispatch = {
      dispatchId,
      requestId,
      candidates: limitedCandidates.map(c => ({ providerActorId: c.providerActorId, offeringId: c.offeringId, eligibilityReason: c.eligibilityReason })),
      rulesApplied: { trust: true, availability: true, online: true, region: true },
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    serviceDispatches.set(dispatchId, dispatch);
    const preReservations = this.createPreReservationsForDispatch(dispatchId, request);
    for (const candidate of limitedCandidates) {
      this.facade.dispatch.recordDispatchSent(dispatchId, candidate.providerActorId, requestId);
    }
    marketplaceLogger.init('Pré-reservas criadas para dispatch', { dispatchId, pre_reservations_count: preReservations.length });
    (request as ServiceRequest & { status: string; dispatchedAt?: string }).status = 'dispatched';
    (request as ServiceRequest & { dispatchedAt: string }).dispatchedAt = new Date().toISOString();
    serviceRequests.set(requestId, request);
    marketplaceLogger.init('Dispatch de requisição de serviço criado', { dispatchId, requestId, candidates_count: limitedCandidates.length });
    return dispatch;
  }

  acceptServiceDispatch(tenantId: string, dispatchId: string, providerActorId: string): Promise<Order> {
    return this.facade.dispatch.acceptServiceDispatch(tenantId, dispatchId, providerActorId);
  }

  // ============================================================
  // BLOCO G — CAPACITY
  // ============================================================

  recalculateResourceCapacity(resourceId: string): void {
    const resource = this.facade.capacity.getServiceResource(resourceId);
    if (!resource) return;

    const serviceOfferings = this.serviceOfferingsAll.filter(so => so.storeId === resource.storeId);
    let totalSlots = 0;
    const now = new Date();
    const currentDay = now.getDay();
    const weekdayMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };

    for (const offering of serviceOfferings) {
      const availability = this.facade.services.getServiceAvailability(offering.offering_id) || [];
      for (const avail of availability) {
        const currentWeekday = weekdayMap[currentDay];
        const availWeekdayName = weekdayMap[avail.weekday as number];
        if (availWeekdayName === currentWeekday) {
          const startHour = parseInt(avail.starts_at.split(':')[0]);
          const endHour = parseInt(avail.ends_at.split(':')[0]);
          const durationMinutes = offering.duration_minutes || 60;
          const slotsPerHour = 60 / durationMinutes;
          const hoursAvailable = endHour - startHour;
          totalSlots += Math.floor(hoursAvailable * slotsPerHour * avail.capacity);
        }
      }
    }

    const servicePreReservations = this.preReservationsMap;
    const serviceDispatches = this.dispatchesMap;
    const serviceRequests = this.requestsMap;
    const serviceBookings = this.bookingsMap;

    const preReservations = Array.from(servicePreReservations.values())
      .filter(pr => {
        const dispatch = serviceDispatches.get(pr.dispatchId);
        if (!dispatch) return false;
        const request = serviceRequests.get(dispatch.requestId);
        if (!request) return false;
        const templateId = (request as { serviceTemplateId?: string }).serviceTemplateId || '';
        const dependencies = this.facade.capacity.getResourceDependenciesByService(templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(pr => {
        const expiresAt = new Date(pr.expiresAt);
        return expiresAt > now && !pr.confirmedAt;
      });

    const confirmedBookings = Array.from(serviceBookings.values())
      .filter(booking => {
        const offering = this.facade.services.getServiceOfferingInternal(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;
        const dependencies = this.facade.capacity.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() >= today.getTime() && booking.status === 'confirmed';
      });

    const inProgressBookings = Array.from(serviceBookings.values())
      .filter(booking => {
        const offering = this.facade.services.getServiceOfferingInternal(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;
        const dependencies = this.facade.capacity.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => booking.status === 'confirmed');

    const utilized = preReservations.length + confirmedBookings.length + inProgressBookings.length;
    resource.currentCapacity = {
      totalSlotsAvailable: totalSlots,
      slotsReserved: preReservations.length,
      slotsConfirmed: confirmedBookings.length,
      slotsInProgress: inProgressBookings.length,
      slotsAvailable: Math.max(0, totalSlots - utilized),
      riskLevel: this.calculateRiskLevel(resource, totalSlots, utilized),
    };

    if (resource.currentCapacity.slotsAvailable === 0 && resource.status === 'active') {
      this.facade.capacity.updateServiceResourceStatus(resourceId, 'overloaded', 'Capacidade disponível zerada');
    } else if (resource.currentCapacity.slotsAvailable > 0 && resource.status === 'overloaded') {
      this.facade.capacity.updateServiceResourceStatus(resourceId, 'active', 'Capacidade disponível restaurada');
    }

    this.updateResourceCapacityMetrics(resourceId);
    this.delegateSetServiceResource(resourceId, resource);
  }

  private calculateRiskLevel(resource: ServiceResource, totalSlots: number, utilizedSlots: number): 'low' | 'medium' | 'high' {
    if (totalSlots === 0) return 'high';
    const utilizationRate = utilizedSlots / totalSlots;
    const historicalMetrics = resource.historicalMetrics;
    if (utilizationRate >= 0.9) return 'high';
    if (utilizationRate >= 0.7) return 'medium';
    if (historicalMetrics.slaExecutionRate < 0.7) return 'high';
    if (historicalMetrics.slaExecutionRate < 0.85) return 'medium';
    if (historicalMetrics.overrunRate > 0.3) return 'high';
    if (historicalMetrics.overrunRate > 0.15) return 'medium';
    return 'low';
  }

  private updateResourceCapacityMetrics(resourceId: string): void {
    const resource = this.facade.capacity.getServiceResource(resourceId);
    if (!resource) return;
    const capacity = resource.currentCapacity;
    const metrics = resource.historicalMetrics;
    const capacityMetrics: ResourceCapacityMetrics = {
      resourceId: resourceId,
      resourceName: resource.name,
      storeId: resource.storeId,
      capacityTotal: capacity.totalSlotsAvailable,
      capacityReserved: capacity.slotsReserved,
      capacityConfirmed: capacity.slotsConfirmed,
      capacityInProgress: capacity.slotsInProgress,
      capacityUtilized: capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress,
      capacityAvailable: capacity.slotsAvailable,
      riskSla: capacity.riskLevel,
      riskFactors: this.getRiskFactors(resource, capacity),
      historicalAverageUtilization: metrics.totalServicesCompleted > 0
        ? (metrics.last30DaysServices / 30) / capacity.totalSlotsAvailable
        : 0,
      historicalPeakUtilization: Math.min(1.0, metrics.last30DaysServices / capacity.totalSlotsAvailable),
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
    this.delegateSetResourceCapacityMetrics(resourceId, capacityMetrics);
  }

  private getRiskFactors(resource: ServiceResource, capacity: ServiceResource['currentCapacity']): string[] {
    const factors: string[] = [];
    if (capacity.slotsAvailable === 0) factors.push('Capacidade zerada');
    if (capacity.riskLevel === 'high') factors.push('Alto risco de quebra de SLA');
    const metrics = resource.historicalMetrics;
    if (metrics.overrunRate > 0.2) factors.push('Alta taxa de atrasos históricos');
    if (metrics.slaExecutionRate < 0.8) factors.push('Taxa de execução dentro do SLA abaixo do esperado');
    if (metrics.cancellationRate > 0.15) factors.push('Alta taxa de cancelamento');
    return factors;
  }

  recalculateCompanyCapacity(storeId: string): void {
    const resources = this.facade.capacity.getServiceResourcesByStore(storeId).filter(r => r.status === 'active' || r.status === 'overloaded');
    if (resources.length === 0) return;

    for (const resource of resources) {
      this.recalculateResourceCapacity(resource.resourceId);
    }

    const resourcesAfter = this.facade.capacity.getServiceResourcesByStore(storeId).filter(r => r.status === 'active' || r.status === 'overloaded');
    let totalCapacity = 0;
    let utilizedCapacity = 0;
    let availableCapacity = 0;
    const bottleneckResources: Array<{ resourceId: string; resourceName: string; utilizationRate: number; riskLevel: 'low' | 'medium' | 'high' }> = [];

    for (const resource of resourcesAfter) {
      const capacity = resource.currentCapacity;
      totalCapacity += capacity.totalSlotsAvailable;
      utilizedCapacity += capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress;
      availableCapacity += capacity.slotsAvailable;
      const utilizationRate = capacity.totalSlotsAvailable > 0
        ? (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable
        : 0;
      if (utilizationRate > 0.8) {
        bottleneckResources.push({
          resourceId: resource.resourceId,
          resourceName: resource.name,
          utilizationRate,
          riskLevel: capacity.riskLevel,
        });
      }
    }

    const saturationRate = totalCapacity > 0 ? utilizedCapacity / totalCapacity : 0;
    const rejectedCount = 0;
    const companyMetrics: CompanyCapacityMetrics = {
      companyId: storeId,
      storeId: storeId,
      period: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      totalCapacity: totalCapacity,
      utilizedCapacity: utilizedCapacity,
      availableCapacity: availableCapacity,
      bottleneckResources: bottleneckResources,
      saturationRate: saturationRate,
      rejectedServicesCount: rejectedCount,
      rejectedServicesLast30Days: rejectedCount,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
    this.delegateSetCompanyCapacityMetrics(storeId, companyMetrics);
  }

  recordCapacityEvent(event: Omit<CapacityEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `capacity-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const capacityEvent: CapacityEvent = {
      eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };
    this.capacityEventsMap.set(eventId, capacityEvent);
    if (event.eventType === 'service_rejected_capacity') {
      try {
        this.delegateTriggerEconomicEvent({
          eventId: `rejected-capacity-${event.details?.serviceRequestId ?? Date.now()}`,
          type: 'service_booked',
          region: { country: 'BR', state: 'N/A', city: 'N/A' },
          actorId: event.storeId,
          referenceId: event.details?.serviceRequestId ?? undefined,
          amountCents: 0,
          visibility: 'restricted',
          displayText: 'Serviço rejeitado por capacidade',
          createdAt: new Date().toISOString(),
        } as import('@contracts/marketplace').EconomicEvent);
      } catch {
        // ignorar
      }
    }
  }

  getEligibleResourcesForMatching(storeId: string, serviceTemplateId: string): ServiceResource[] {
    const resources = this.facade.capacity.getServiceResourcesByStore(storeId)
      .filter(r => {
        if (r.status !== 'active') return false;
        const dependencies = this.facade.capacity.getResourceDependenciesByService(serviceTemplateId);
        if (dependencies.length === 0) return true;
        return dependencies.some(d => d.requiredResources.includes(r.resourceId));
      })
      .filter(r => r.currentCapacity.slotsAvailable > 0);
    return resources;
  }

  calculateRegionalCapacityMetric(
    regionId: string,
    serviceCategory: string,
    period?: { start: string; end: string }
  ): RegionalCapacityMetric {
    const now = new Date();
    const periodStart = period?.start ? new Date(period.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = period?.end ? new Date(period.end) : now;

    const stores = this.facade.catalog.getStores();
    const regionStores = stores.stores.filter(store => {
      if (regionId.includes('-')) {
        const [city, neighborhood] = regionId.split('-');
        return store.branches.some(b => b.location?.city === city && b.location?.neighborhood === neighborhood);
      }
      return store.branches.some(b => b.location?.city === regionId);
    });

    const allResources: ServiceResource[] = [];
    for (const store of regionStores) {
      allResources.push(...this.facade.capacity.getServiceResourcesByStore(store.storeId));
    }

    const totalResources = allResources.length;
    const activeResources = allResources.filter(r => r.status === 'active').length;
    const overloadedResources = allResources.filter(r => r.status === 'overloaded').length;

    let totalUtilization = 0;
    let peakUtilization = 0;
    for (const resource of allResources) {
      const capacity = resource.currentCapacity;
      if (capacity.totalSlotsAvailable > 0) {
        const utilization = (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable;
        totalUtilization += utilization;
        peakUtilization = Math.max(peakUtilization, utilization);
      }
    }
    const avgUtilizationRate = totalResources > 0 ? totalUtilization / totalResources : 0;

    const capacityEvents = Array.from(this.capacityEventsMap.values())
      .filter(e => {
        if (e.resourceId) {
          return !!allResources.find(r => r.resourceId === e.resourceId);
        }
        return regionStores.some(s => s.storeId === e.storeId);
      })
      .filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= periodStart && eventDate <= periodEnd;
      })
      .filter(e => e.eventType === 'resource_overloaded');
    const overloadEventsCount = capacityEvents.length;

    const serviceRequests = Array.from(this.requestsMap.values())
      .filter(r => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      });
    const totalRequests = serviceRequests.length;
    const expiredRequests = serviceRequests.filter(r => {
      const expiredAt = r.expiredAt ? new Date(r.expiredAt) : null;
      return expiredAt && expiredAt < now;
    }).length;
    const requestExpirationRate = totalRequests > 0 ? expiredRequests / totalRequests : 0;

    const serviceDispatches = this.dispatchesMap;
    const dispatches = Array.from(serviceDispatches.values()).filter(d => {
      return !!serviceRequests.find(r => r.requestId === d.requestId);
    });
    const totalDispatches = dispatches.length;
    const rejectedDispatches = dispatches.filter(d => d.status === 'declined' || d.status === 'expired').length;
    const dispatchRejectionRate = totalDispatches > 0 ? rejectedDispatches / totalDispatches : 0;

    let totalResponseTime = 0, responseTimeCount = 0, totalExecutionTime = 0, executionTimeCount = 0, totalConfirmationTime = 0, confirmationTimeCount = 0;
    for (const dispatch of dispatches) {
      if (dispatch.createdAt && dispatch.acceptedAt) {
        totalResponseTime += (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        responseTimeCount++;
      }
      const request = serviceRequests.find(r => r.requestId === dispatch.requestId);
      if (request?.acceptedAt) {
        totalExecutionTime += (new Date(request.acceptedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        executionTimeCount++;
      }
      if (dispatch.acceptedAt && dispatch.createdAt) {
        totalConfirmationTime += (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        confirmationTimeCount++;
      }
    }
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgConfirmationTime = confirmationTimeCount > 0 ? totalConfirmationTime / confirmationTimeCount : 0;
    const executedRequests = serviceRequests.filter(r => r.status === 'accepted' && (r as { completedAt?: string }).completedAt).length;
    const requestToExecutionRate = totalRequests > 0 ? executedRequests / totalRequests : 0;

    const governanceValues = Array.from(this.serviceGovernanceMetricsMap.values());
    const slaMetrics = governanceValues.filter((m: ServiceGovernanceMetrics) => !!allResources.find(r => r.actorId === m.providerActorId));
    const totalSLA = slaMetrics.length;
    const violatedSLA = slaMetrics.filter((m: ServiceGovernanceMetrics) => m.status === 'sla_violation').length;
    const slaViolationRate = totalSLA > 0 ? violatedSLA / totalSLA : 0;

    const slaRiskLevel: SLARiskLevel = this.calculateSLARiskLevel(avgResponseTime, avgExecutionTime, slaViolationRate, requestExpirationRate);
    const { status, bottleneckCause, bottleneckDetails } = this.classifyRegionalCapacity(
      avgUtilizationRate, requestExpirationRate, dispatchRejectionRate, avgConfirmationTime, requestToExecutionRate, overloadedResources, totalResources
    );

    const metric: RegionalCapacityMetric = {
      regionId,
      serviceCategory,
      totalResources,
      activeResources,
      overloadedResources,
      avgUtilizationRate,
      peakUtilizationRate: peakUtilization,
      overloadEventsCount,
      requestExpirationRate,
      dispatchRejectionRate,
      avgResponseTimeMinutes: avgResponseTime,
      avgExecutionTimeMinutes: avgExecutionTime,
      avgConfirmationTimeMinutes: avgConfirmationTime,
      slaRiskLevel,
      slaViolationRate,
      requestToExecutionRate,
      status,
      bottleneckCause: bottleneckCause,
      bottleneckDetails: bottleneckDetails,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    const metricKey = `${regionId}-${serviceCategory}`;
    this.regionalCapacityMetricsMap.set(metricKey, metric);
    return metric;
  }

  private calculateSLARiskLevel(
    avgResponseTime: number,
    avgExecutionTime: number,
    slaViolationRate: number,
    requestExpirationRate: number
  ): SLARiskLevel {
    if (slaViolationRate > 0.3 || requestExpirationRate > 0.5) return 'high';
    if (avgResponseTime > 60 || avgExecutionTime > 120) return 'high';
    if (slaViolationRate > 0.15 || requestExpirationRate > 0.3) return 'medium';
    if (avgResponseTime > 30 || avgExecutionTime > 90) return 'medium';
    return 'low';
  }

  private classifyRegionalCapacity(
    avgUtilizationRate: number,
    requestExpirationRate: number,
    dispatchRejectionRate: number,
    avgConfirmationTime: number,
    requestToExecutionRate: number,
    overloadedResources: number,
    totalResources: number
  ): { status: RegionalCapacityStatus; bottleneckCause?: BottleneckCause; bottleneckDetails?: string } {
    if (totalResources > 0 && overloadedResources / totalResources > 0.3 && requestExpirationRate > 0.4) {
      return {
        status: 'critical',
        bottleneckCause: 'lack_of_professionals',
        bottleneckDetails: `Alta taxa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%) e alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)`,
      };
    }
    if (requestToExecutionRate < 0.3 && dispatchRejectionRate > 0.5) {
      return {
        status: 'critical',
        bottleneckCause: 'excess_demand',
        bottleneckDetails: `Baixa taxa de conversão (${Math.round(requestToExecutionRate * 100)}%) e alta rejeição de dispatches (${Math.round(dispatchRejectionRate * 100)}%)`,
      };
    }
    if (avgUtilizationRate > 0.8 && avgConfirmationTime > 60) {
      return { status: 'warning', bottleneckCause: 'schedule_bottleneck', bottleneckDetails: `Alta utilização (${Math.round(avgUtilizationRate * 100)}%) e tempo médio de confirmação alto (${Math.round(avgConfirmationTime)} minutos)` };
    }
    if (requestExpirationRate > 0.3) {
      return { status: 'warning', bottleneckCause: 'lack_of_professionals', bottleneckDetails: `Alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)` };
    }
    if (totalResources > 0 && overloadedResources / totalResources > 0.2) {
      return { status: 'warning', bottleneckCause: 'capacity_distribution_issue', bottleneckDetails: `Proporção significativa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%)` };
    }
    return { status: 'healthy' };
  }

  // ============================================================
  // BLOCO H — REPORTING (Real Operation + Service Margin)
  // ============================================================

  calculateRealOperationMetrics(
    storeId: string,
    companyId: string,
    period: { start: string; end: string }
  ): RealOperationMetrics {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    const serviceOrdersMap = this.ordersMap;
    const serviceOrders = Array.from(serviceOrdersMap.values())
      .filter(o => {
        const orderDate = new Date((o as { createdAt?: string }).createdAt ?? 0);
        return orderDate >= periodStart && orderDate <= periodEnd && (o as { status?: string }).status === 'completed';
      })
      .filter(o => {
        const offering = this.facade.services.getServiceOfferingInternal(o.offeringId);
        if (!offering) return false;
        return offering.storeId === storeId;
      });

    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averageTicket = serviceOrders.length > 0 ? totalRevenue / serviceOrders.length : 0;

    let totalExecutionTime = 0, executionTimeCount = 0, totalResponseTime = 0, responseTimeCount = 0;
    const serviceRequests = this.requestsMap;
    const serviceDispatches = this.dispatchesMap;

    for (const order of serviceOrders) {
      const requestId = (order as { requestId?: string }).requestId;
      const request = requestId ? serviceRequests.get(requestId) : undefined;
      if (request) {
        const reqCompletedAt = (request as unknown as { completedAt?: string }).completedAt;
        if (reqCompletedAt && request.createdAt) {
          const executionTime = (new Date(reqCompletedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
          totalExecutionTime += executionTime;
          executionTimeCount++;
        }
        const dispatch = Array.from(serviceDispatches.values()).find(d => d.requestId === request.requestId && d.status === 'accepted');
        if (dispatch?.createdAt && dispatch.acceptedAt) {
          const responseTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }
    }

    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    const offeringsAll = this.serviceOfferingsAll;
    const allRequests = Array.from(serviceRequests.values())
      .filter(r => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      })
      .filter(r => {
        const order = serviceOrders.find(so => (so as { requestId?: string }).requestId === r.requestId);
        const offering = order ? offeringsAll.find(o => o.offering_id === order.offeringId) : undefined;
        return !!offering;
      });

    const totalRequests = allRequests.length;
    const cancelledRequests = allRequests.filter(r => r.status === 'cancelled' || r.status === 'expired').length;
    const cancellationRate = totalRequests > 0 ? cancelledRequests / totalRequests : 0;

    return {
      storeId,
      companyId,
      period,
      averageTicket: { amountCents: averageTicket, currency: 'BRL' },
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalServices: serviceOrders.length,
      averageExecutionTimeMinutes: avgExecutionTime,
      averageResponseTimeMinutes: avgResponseTime,
      cancellationRate,
      cancelledServicesCount: cancelledRequests,
      totalRequestsCount: totalRequests,
      servicesAtLoss: 0,
      servicesAtLossPercentage: 0,
      totalLossAmount: { amountCents: 0, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  calculateServiceMarginAnalysis(
    storeId: string,
    serviceOfferingId: string,
    costProfile: OperationalCostProfile,
    period: { start: string; end: string }
  ): ServiceMarginAnalysis | null {
    const offering = this.facade.services.getServiceOfferingInternal(serviceOfferingId);
    if (!offering || offering.storeId !== storeId) return null;

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    const serviceOrdersMap = this.ordersMap;
    const serviceOrders = Array.from(serviceOrdersMap.values())
      .filter(o => {
        const orderDate = new Date((o as { createdAt?: string }).createdAt ?? 0);
        return orderDate >= periodStart && orderDate <= periodEnd && (o as { status?: string }).status === 'completed';
      })
      .filter(o => o.offeringId === serviceOfferingId);

    if (serviceOrders.length === 0) return null;

    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averagePrice = totalRevenue / serviceOrders.length;

    const variableCost = costProfile.variableCostsPerService.averagePerService.amountCents;
    const fixedCostPerService = costProfile.fixedCostsMonthly.totalCents.amountCents / Math.max(serviceOrders.length, 1);
    const averageCost = variableCost + fixedCostPerService;

    const marginPerService = averagePrice - averageCost;
    const marginPercentage = averagePrice > 0 ? (marginPerService / averagePrice) * 100 : 0;
    const isProfitable = marginPerService > 0;
    const totalCost = averageCost * serviceOrders.length;

    const templates = this.facade.services.getServiceTemplates().templates;
    const template = templates.find(t => t.templateId === offering.templateId);
    const serviceName = template?.name ?? 'Serviço';

    return {
      serviceOfferingId,
      serviceName,
      averagePrice: { amountCents: averagePrice, currency: 'BRL' },
      averageCost: { amountCents: averageCost, currency: 'BRL' },
      marginPerService: { amountCents: marginPerService, currency: 'BRL' },
      marginPercentage,
      isProfitable,
      servicesExecutedCount: serviceOrders.length,
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalCost: { amountCents: totalCost, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }
}