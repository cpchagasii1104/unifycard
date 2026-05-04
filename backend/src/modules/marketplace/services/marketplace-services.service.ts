// backend/src/modules/marketplace/services/marketplace-services.service.ts
// Agregador: templates de serviço, ofertas, bookings, service orders e conclusão.
// Estado (visits, quotes, governance) vive nos domain services (service-lifecycle); este agregador apenas delega.

import type { ServiceOrder, ServiceOffering, ServiceVisit, ServiceQuote, ServiceEvaluation, EvaluationAggregate } from '@contracts/marketplace';
import type { OfferingsApplicationService } from '../application/services/offerings-application.service';
import type { OrdersApplicationService } from '../application/services/orders-application.service';
import type { MarketplaceServicesModule } from '../marketplace-services.service';
import type { MarketplaceServiceLifecycleService } from '../domain/services/marketplace-service-lifecycle.service';
import { marketplaceLogger } from '../marketplace.logger';

export class MarketplaceServicesAggregatorService {
  constructor(
    private readonly offerings: OfferingsApplicationService,
    private readonly orders: OrdersApplicationService,
    private readonly servicesModule: MarketplaceServicesModule,
    private readonly serviceLifecycleDomain: MarketplaceServiceLifecycleService
  ) {}

  getServiceTemplates(): {
    domain: string;
    version: string;
    templates: Array<{
      templateId: string;
      name: string;
      description: string;
      categoryId: string;
      type: 'session' | 'recurring' | 'rental';
      default_duration_minutes?: number;
      pricing_model: 'per_session' | 'per_period';
    }>;
  } {
    return this.offerings.getServiceTemplates();
  }

  getStoreServiceOfferings(storeId: string): {
    storeId: string;
    offerings: Array<{
      offering_id: string;
      templateId: string;
      name: string;
      description: string;
      price: { amountCents: number; currency: string };
      duration_minutes?: number;
      recurrence?: 'weekly' | 'monthly';
      isActive: boolean;
    }>;
  } {
    return this.offerings.getStoreServiceOfferings(storeId);
  }

  getServiceAvailability(offeringId: string): Array<{
    weekday: number;
    starts_at: string;
    ends_at: string;
    capacity: number;
  }> {
    return this.offerings.getServiceAvailability(offeringId);
  }

  createServiceBooking(input: {
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
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
    return this.offerings.createServiceBooking(input);
  }

  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: { amountCents: number; currency: string };
  } {
    return this.offerings.confirmServiceBooking(bookingId);
  }

  getServiceBooking(bookingId: string): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: string;
    createdAt: string;
  } | null {
    return this.offerings.getServiceBooking(bookingId);
  }

  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return this.offerings.getServiceOrderByBooking(bookingId);
  }

  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.offerings.getServiceOrder(orderId);
  }

  getServiceBookingsMap(): Map<string, {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
    createdAt: string;
  }> {
    return this.offerings.getServiceBookingsMap();
  }

  getServiceOfferingInternal(offeringId: string): {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: { amountCents: number; currency: string };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  } | null {
    return this.offerings.getServiceOffering(offeringId);
  }

  getServiceOrdersMap(): Map<string, ServiceOrder> {
    return this.offerings.getServiceOrdersMap();
  }

  getServiceOffering(offeringId: string): ServiceOffering | null {
    const raw = this.offerings.getServiceOffering(offeringId);
    return raw ? (raw as unknown as ServiceOffering) : null;
  }

  addServiceOrderToOrder(
    orderId: string,
    serviceOrderId: string
  ): {
    orderId: string;
    storeId: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: Array<{
      productId: string;
      name: string;
      price: { amountCents: number; currency: string };
      quantity: number;
      subtotal: number;
    }>;
    totalCents: number;
  } {
    return this.orders.addServiceOrderToOrder(orderId, serviceOrderId);
  }

  completeServiceRequest(requestId: string, completedBy: string): {
    requestId: string;
    status: 'completed';
    completedAt: string;
    completedBy: string;
  } {
    const result = this.servicesModule.completeServiceRequest(requestId, completedBy);
    return { ...result, completedBy };
  }

  // --- Service Lifecycle (visits/quotes): delegação ao domain ---

  createServiceVisit(input: {
    requestId: string;
    dispatchId: string;
    providerActorId: string;
    scheduledDate: string;
    scheduledTime: string;
  }): ServiceVisit {
    const visit = this.serviceLifecycleDomain.createServiceVisit(input);
    marketplaceLogger.init('ServiceVisit criada', {
      visitId: visit.visitId,
      requestId: visit.requestId,
      providerActorId: visit.providerActorId,
    });
    return visit;
  }

  completeServiceVisit(visitId: string): ServiceVisit {
    const visit = this.serviceLifecycleDomain.completeServiceVisit(visitId);
    marketplaceLogger.init('Visita marcada como completa', { visitId });
    return visit;
  }

  getServiceVisit(visitId: string): ServiceVisit | null {
    return this.serviceLifecycleDomain.getServiceVisit(visitId);
  }

  getServiceVisitsByRequest(requestId: string): ServiceVisit[] {
    return this.serviceLifecycleDomain.getServiceVisitsByRequest(requestId);
  }

  getServiceQuote(quoteId: string): ServiceQuote | null {
    return this.serviceLifecycleDomain.getServiceQuote(quoteId);
  }

  getServiceQuotesByRequest(requestId: string): ServiceQuote[] {
    return this.serviceLifecycleDomain.getServiceQuotesByRequest(requestId);
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
    return this.servicesModule.createServiceQuote(input);
  }

  async acceptServiceQuote(quoteId: string, customerActorId: string): Promise<{
    quoteId: string;
    bookingId: string;
    orderId: string;
    paymentHoldId: string;
  }> {
    return this.servicesModule.acceptServiceQuote(quoteId, customerActorId);
  }

  declineServiceQuote(quoteId: string, customerActorId: string): ServiceQuote {
    return this.servicesModule.declineServiceQuote(quoteId, customerActorId);
  }

  getServiceVisitsMap(): Map<string, ServiceVisit> {
    return this.serviceLifecycleDomain.getServiceVisitsMap();
  }

  getServiceQuotesMap(): Map<string, ServiceQuote> {
    return this.serviceLifecycleDomain.getServiceQuotesMap();
  }

  // --- Service evaluations (API explícita; implementação futura) ---

  createServiceEvaluation(input: {
    request_id: string;
    evaluator_type: 'user' | 'provider';
    evaluator_actor_id: string;
    scores: { execution_quality: number; punctuality: number; communication: number; compliance: number };
  }): ServiceEvaluation & { evaluation_id: string } {
    throw new Error('Service evaluations: not implemented');
  }

  getActorEvaluations(
    actorId: string,
    period?: { starts_at?: string; ends_at?: string }
  ): (ServiceEvaluation & { evaluation_id: string })[] {
    return [];
  }

  calculateEvaluationAggregates(
    actorId: string,
    period: { starts_at: string; ends_at: string }
  ): EvaluationAggregate {
    throw new Error('Service evaluations: not implemented');
  }

  getEvaluationWindow(requestId: string): { requestId: string; opensAt: string; closesAt: string } | null {
    return null;
  }
}