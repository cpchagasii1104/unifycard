// backend/src/modules/marketplace/application/services/offerings-application.service.ts
// Application Service: orquestração do domínio Offerings (delegação ao domain module).

import type { MarketplaceOfferingsModule } from '../../domain/offerings/marketplace-offerings.service';
import type { ServiceOrder } from '@contracts/marketplace';

export class OfferingsApplicationService {
  constructor(private readonly offeringsModule: MarketplaceOfferingsModule) {}

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
    return this.offeringsModule.getServiceTemplates();
  }

  getServiceOfferingsMap() {
    return this.offeringsModule.getServiceOfferingsMap();
  }

  getServiceAvailabilitiesMap() {
    return this.offeringsModule.getServiceAvailabilitiesMap();
  }

  getServiceBookingsMap() {
    return this.offeringsModule.getServiceBookingsMap();
  }

  getServiceOrdersMap(): Map<string, ServiceOrder> {
    return this.offeringsModule.getServiceOrdersMap();
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
    return this.offeringsModule.getStoreServiceOfferings(storeId);
  }

  getServiceAvailability(offeringId: string): Array<{
    weekday: number;
    starts_at: string;
    ends_at: string;
    capacity: number;
  }> {
    return this.offeringsModule.getServiceAvailability(offeringId);
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
    return this.offeringsModule.createServiceBooking(input);
  }

  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: { amountCents: number; currency: string };
  } {
    return this.offeringsModule.confirmServiceBooking(bookingId);
  }

  getServiceBooking(bookingId: string): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
    createdAt: string;
  } | null {
    return this.offeringsModule.getServiceBooking(bookingId);
  }

  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return this.offeringsModule.getServiceOrderByBooking(bookingId);
  }

  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.offeringsModule.getServiceOrder(orderId);
  }

  getServiceOffering(offeringId: string): {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: { amountCents: number; currency: string };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  } | null {
    return this.offeringsModule.getServiceOffering(offeringId);
  }

  initializeOfferingsSeed(): void {
    this.offeringsModule.initializeOfferingsSeed();
  }

  /** Cria/registra offering no domain (única escrita permitida via application). */
  addServiceOffering(offering: {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: { amountCents: number; currency: string };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  }): void {
    this.offeringsModule.addOffering(offering);
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
    return this.offeringsModule.getBookingsByOfferingDateTime(offeringId, date, time);
  }
}