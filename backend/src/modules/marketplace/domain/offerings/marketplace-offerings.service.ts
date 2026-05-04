// backend/src/modules/marketplace/marketplace-offerings.service.ts
// Módulo Offerings: catálogo de serviços, ofertas, disponibilidade, bookings e service orders

import type { MarketplaceService } from '../../marketplace.service';
import { marketplaceLogger } from '../../marketplace.logger';
import type { ServiceOrder } from '@contracts/marketplace';

type ServiceOfferingInternal = {
  offering_id: string;
  storeId: string;
  templateId: string;
  price: { amountCents: number; currency: string };
  duration_minutes?: number;
  recurrence?: 'weekly' | 'monthly';
  isActive: boolean;
};

type ServiceAvailabilitySlot = {
  offering_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  capacity: number;
};

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

export class MarketplaceOfferingsModule {
  private readonly serviceOfferings = new Map<string, ServiceOfferingInternal>();
  private readonly serviceAvailabilities = new Map<string, ServiceAvailabilitySlot[]>();
  private readonly serviceBookings = new Map<string, ServiceBookingInternal>();
  private readonly serviceOrders = new Map<string, ServiceOrder>();

  constructor(private readonly facade: MarketplaceService) {}

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
    return {
      domain: 'marketplace',
      version: 'v0',
      templates: [
        { templateId: 'gym-session', name: 'Aula de Academia', description: 'Aula individual ou em grupo na academia', categoryId: 'fitness', type: 'session', default_duration_minutes: 60, pricing_model: 'per_session' },
        { templateId: 'consultation', name: 'Consulta', description: 'Consulta profissional (médica, jurídica, etc.)', categoryId: 'professional', type: 'session', default_duration_minutes: 30, pricing_model: 'per_session' },
        { templateId: 'property-rental', name: 'Aluguel de Imóvel', description: 'Aluguel de imóvel residencial ou comercial', categoryId: 'real-estate', type: 'rental', pricing_model: 'per_period' },
        { templateId: 'maintenance', name: 'Manutenção', description: 'Serviço de manutenção técnica', categoryId: 'technical', type: 'session', default_duration_minutes: 120, pricing_model: 'per_session' },
        { templateId: 'haircut', name: 'Corte de Cabelo', description: 'Corte de cabelo no salão', categoryId: 'beauty', type: 'session', default_duration_minutes: 45, pricing_model: 'per_session' },
        { templateId: 'cleaning', name: 'Limpeza', description: 'Serviço de limpeza residencial ou comercial', categoryId: 'home-services', type: 'session', default_duration_minutes: 180, pricing_model: 'per_session' },
      ],
    };
  }

  getServiceOrdersMap(): Map<string, ServiceOrder> {
    return this.serviceOrders;
  }

  getServiceBookingsMap(): Map<string, ServiceBookingInternal> {
    return this.serviceBookings;
  }

  getServiceOfferingsMap(): Map<string, ServiceOfferingInternal> {
    return this.serviceOfferings;
  }

  getServiceAvailabilitiesMap(): Map<string, ServiceAvailabilitySlot[]> {
    return this.serviceAvailabilities;
  }

  getServiceOffering(offeringId: string): ServiceOfferingInternal | null {
    return this.serviceOfferings.get(offeringId) ?? null;
  }

  /** Única escrita permitida no Map de offerings; SSOT no domain. */
  addOffering(offering: ServiceOfferingInternal): void {
    this.serviceOfferings.set(offering.offering_id, offering);
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
    const templates = this.getServiceTemplates();
    const offerings = Array.from(this.serviceOfferings.values())
      .filter(o => o.storeId === storeId && o.isActive)
      .map(o => {
        const template = templates.templates.find(t => t.templateId === o.templateId);
        return {
          offering_id: o.offering_id,
          templateId: o.templateId,
          name: template?.name || 'Serviço',
          description: template?.description || '',
          price: o.price,
          duration_minutes: o.duration_minutes ?? template?.default_duration_minutes,
          recurrence: o.recurrence,
          isActive: o.isActive,
        };
      });
    return { storeId, offerings };
  }

  getServiceAvailability(offeringId: string): ServiceAvailabilitySlot[] {
    return this.serviceAvailabilities.get(offeringId) || [];
  }

  createServiceBooking(input: {
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
  }): ServiceBookingInternal {
    const offering = this.serviceOfferings.get(input.offeringId);
    if (!offering || !offering.isActive) throw new Error('Serviço não encontrado ou inativo');

    const availability = this.getServiceAvailability(input.offeringId);
    const dateObj = new Date(input.date);
    const weekday = dateObj.getDay();
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) throw new Error('Horário não disponível para este dia');

    if (input.time < slot.starts_at || input.time >= slot.ends_at) throw new Error('Horário fora do período disponível');

    const existingBookings = Array.from(this.serviceBookings.values())
      .filter(b => b.offeringId === input.offeringId && b.date === input.date && b.time === input.time && b.status !== 'cancelled');
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
    this.serviceBookings.set(bookingId, booking);
    return booking;
  }

  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: { amountCents: number; currency: string };
  } {
    const booking = this.serviceBookings.get(bookingId);
    if (!booking) throw new Error('Reserva não encontrada');
    if (booking.status !== 'reserved') throw new Error('Reserva já foi confirmada ou cancelada');

    const offering = this.serviceOfferings.get(booking.offeringId);
    if (!offering) throw new Error('Oferta não encontrada');

    const unitCents = 'amountCents' in offering.price ? offering.price.amountCents : Math.round((offering.price as { amount: number }).amount * 100);
    const totalPriceCents = unitCents * booking.quantity;

    const orderId = `service-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceOrder: ServiceOrder = {
      orderId,
      bookingId,
      offeringId: booking.offeringId,
      price: { amountCents: totalPriceCents, currency: offering.price.currency },
      channel: 'online',
      createdAt: new Date().toISOString(),
    };
    this.serviceOrders.set(orderId, serviceOrder);

    booking.status = 'confirmed';
    this.serviceBookings.set(bookingId, booking);

    return { bookingId, orderId, offeringId: booking.offeringId, price: serviceOrder.price };
  }

  getServiceBooking(bookingId: string): ServiceBookingInternal | null {
    return this.serviceBookings.get(bookingId) || null;
  }

  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return Array.from(this.serviceOrders.values()).find(o => o.bookingId === bookingId) || null;
  }

  /**
   * Buscar bookings por offering, data e horário (helper para evitar duplicação)
   */
  getBookingsByOfferingDateTime(offeringId: string, date: string, time: string): Array<ServiceBookingInternal> {
    return Array.from(this.serviceBookings.values())
      .filter(b => b.offeringId === offeringId && b.date === date && b.time === time);
  }

  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.serviceOrders.get(orderId) || null;
  }

  initializeOfferingsSeed(): void {
    const offering1Id = 'offering-001';
    this.serviceOfferings.set(offering1Id, {
      offering_id: offering1Id,
      storeId: 'store-001',
      templateId: 'gym-session',
      price: { amountCents: 50.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });

    const offering2Id = 'offering-002';
    this.serviceOfferings.set(offering2Id, {
      offering_id: offering2Id,
      storeId: 'store-001',
      templateId: 'consultation',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 30,
      isActive: true,
    });

    this.serviceAvailabilities.set(offering1Id, [
      { offering_id: offering1Id, weekday: 1, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 2, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 3, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 4, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 5, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
    ]);
    this.serviceAvailabilities.set(offering2Id, [
      { offering_id: offering2Id, weekday: 1, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 2, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 3, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 4, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 5, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
    ]);

    const manicureOffering1Id = 'offering-manicure-001';
    const manicureOffering2Id = 'offering-manicure-002';
    this.serviceOfferings.set(manicureOffering1Id, {
      offering_id: manicureOffering1Id,
      storeId: 'store-001',
      templateId: 'beauty-service',
      price: { amountCents: 30.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });
    this.serviceOfferings.set(manicureOffering2Id, {
      offering_id: manicureOffering2Id,
      storeId: 'store-002',
      templateId: 'beauty-service',
      price: { amountCents: 35.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });

    const allWeekdays = [0, 1, 2, 3, 4, 5, 6];
    this.serviceAvailabilities.set(manicureOffering1Id, allWeekdays.map(w => ({
      offering_id: manicureOffering1Id,
      weekday: w,
      starts_at: '08:00',
      ends_at: '20:00',
      capacity: 5,
    })));
    this.serviceAvailabilities.set(manicureOffering2Id, allWeekdays.map(w => ({
      offering_id: manicureOffering2Id,
      weekday: w,
      starts_at: '08:00',
      ends_at: '20:00',
      capacity: 5,
    })));

    const limpezaOfferingId = 'offering-limpeza-001';
    const caixaAguaOfferingId = 'offering-caixa-agua-001';
    this.serviceOfferings.set(limpezaOfferingId, {
      offering_id: limpezaOfferingId,
      storeId: 'store-001',
      templateId: 'cleaning-service',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 120,
      isActive: true,
    });
    this.serviceOfferings.set(caixaAguaOfferingId, {
      offering_id: caixaAguaOfferingId,
      storeId: 'store-002',
      templateId: 'maintenance-service',
      price: { amountCents: 200.00, currency: 'BRL' },
      duration_minutes: 90,
      isActive: true,
    });

    const weekdays = [1, 2, 3, 4, 5];
    this.serviceAvailabilities.set(limpezaOfferingId, weekdays.map(w => ({
      offering_id: limpezaOfferingId,
      weekday: w,
      starts_at: '08:00',
      ends_at: '18:00',
      capacity: 3,
    })));
    this.serviceAvailabilities.set(caixaAguaOfferingId, weekdays.map(w => ({
      offering_id: caixaAguaOfferingId,
      weekday: w,
      starts_at: '08:00',
      ends_at: '18:00',
      capacity: 2,
    })));

    marketplaceLogger.init('Exemplos de serviços seeded para orquestrador', {
      manicure_offerings: 2,
      combo_offerings: 2,
    });
  }
}