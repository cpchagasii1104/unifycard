// backend/src/modules/marketplace/service-booking.service.ts
// Módulo isolado de Service Booking
// Extraído de marketplace.service.ts para reduzir acoplamento

import type {
  ServiceBooking,
  ServiceOffering,
  ServiceOrder,
  ServiceTemplateCanonical,
} from '@contracts/marketplace';

export class ServiceBookingService {
  constructor(
    private serviceOfferings: Map<string, ServiceOffering>,
    private serviceBookings: Map<string, ServiceBooking>,
    private serviceOrders: Map<string, ServiceOrder>
  ) {}

  /**
   * ServiceTemplate (canônico, read-only)
   * Templates reutilizáveis de serviços
   */
  getServiceTemplates(): ServiceTemplateCanonical[] {
    const now = new Date().toISOString();
    return [
      {
        templateId: 'gym-session',
        name: 'Aula de Academia',
        description: 'Aula individual ou em grupo na academia',
        categoryId: 'fitness',
        type: 'one_time',
        defaultDurationMinutes: 60,
        defaultPricingModel: 'fixed',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
      {
        templateId: 'consultation',
        name: 'Consulta',
        description: 'Consulta profissional (médica, jurídica, etc.)',
        categoryId: 'professional',
        type: 'one_time',
        defaultDurationMinutes: 30,
        defaultPricingModel: 'fixed',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
      {
        templateId: 'property-rental',
        name: 'Aluguel de Imóvel',
        description: 'Aluguel de imóvel residencial ou comercial',
        categoryId: 'real-estate',
        type: 'recurring',
        defaultPricingModel: 'per_unit',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
      {
        templateId: 'maintenance',
        name: 'Manutenção',
        description: 'Serviço de manutenção técnica',
        categoryId: 'technical',
        type: 'one_time',
        defaultDurationMinutes: 120,
        defaultPricingModel: 'hourly',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
      {
        templateId: 'haircut',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo no salão',
        categoryId: 'beauty',
        type: 'one_time',
        defaultDurationMinutes: 45,
        defaultPricingModel: 'fixed',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
      {
        templateId: 'cleaning',
        name: 'Limpeza',
        description: 'Serviço de limpeza residencial ou comercial',
        categoryId: 'home-services',
        type: 'one_time',
        defaultDurationMinutes: 180,
        defaultPricingModel: 'hourly',
        canonicalImages: {},
        attributes: {},
        version: 'v1',
        createdAt: now,
        immutable: true,
      },
    ];
  }

  /**
   * Buscar ofertas de serviços de uma loja
   */
  getStoreServiceOfferings(storeId: string): {
    storeId: string;
    offerings: Array<{
      offeringId: string;
      templateId: string;
      name: string;
      description: string;
      price: {
        amountCents: number;
        currency: string;
      };
      durationMinutes?: number;
      recurrence?: 'weekly' | 'monthly';
      isActive: boolean;
    }>;
  } {
    const offerings = Array.from(this.serviceOfferings.values())
      .filter(o => o.storeId === storeId && o.isActive)
      .map(o => {
        const template = this.getServiceTemplates().find(t => t.templateId === o.templateId);
        return {
          offeringId: o.offeringId,
          templateId: o.templateId,
          name: template?.name || 'Serviço',
          description: template?.description || '',
          price: o.price,
          durationMinutes: o.durationMinutes || template?.defaultDurationMinutes,
          recurrence: o.recurrence,
          isActive: o.isActive,
        };
      });

    return {
      storeId: storeId,
      offerings,
    };
  }

  /**
   * Criar reserva de serviço
   */
  createServiceBooking(
    input: {
      offeringId: string;
      userId: string;
      date: string; // YYYY-MM-DD
      time: string; // HH:mm
      quantity: number;
    },
    getServiceAvailability: (offeringId: string) => Array<{
      weekday: number;
      startsAt: string;
      endsAt: string;
      capacity: number;
    }>
  ): ServiceBooking {
    // Validar que o serviço existe e está ativo
    const offering = this.serviceOfferings.get(input.offeringId);
    if (!offering || !offering.isActive) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    // Validar disponibilidade
    const availability = getServiceAvailability(input.offeringId);
    const dateObj = new Date(input.date);
    const weekday = dateObj.getDay();
    
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) {
      throw new Error('Horário não disponível para este dia');
    }

    // Validar horário dentro do slot
    const requestedTime = input.time;
    if (requestedTime < slot.startsAt || requestedTime >= slot.endsAt) {
      throw new Error('Horário fora do período disponível');
    }

    // Validar capacidade
    const existingBookings = Array.from(this.serviceBookings.values())
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

    const booking: ServiceBooking = {
      bookingId: bookingId,
      offeringId: input.offeringId,
      userId: input.userId,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      status: 'reserved',
      createdAt: new Date().toISOString(),
    };

    this.serviceBookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Confirmar reserva e criar ServiceOrder
   */
  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: {
      amountCents: number;
      currency: string;
    };
  } {
    const booking = this.serviceBookings.get(bookingId);
    if (!booking) {
      throw new Error('Reserva não encontrada');
    }

    if (booking.status !== 'reserved') {
      throw new Error('Reserva já foi confirmada ou cancelada');
    }

    // Buscar oferta
    const offering = this.serviceOfferings.get(booking.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    // Calcular preço total
    const totalPrice = offering.price.amountCents * booking.quantity;

    // Criar ServiceOrder
    const orderId = `service-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceOrder: ServiceOrder = {
      orderId: orderId,
      bookingId: bookingId,
      offeringId: booking.offeringId,
      price: {
        amountCents: totalPrice,
        currency: offering.price.currency,
      },
      channel: 'online',
      createdAt: new Date().toISOString(),
    };

    this.serviceOrders.set(orderId, serviceOrder);

    // Confirmar reserva
    booking.status = 'confirmed';
    this.serviceBookings.set(bookingId, booking);

    return {
      bookingId: bookingId,
      orderId: orderId,
      offeringId: booking.offeringId,
      price: serviceOrder.price,
    };
  }

  /**
   * Buscar reserva por ID
   */
  getServiceBooking(bookingId: string): ServiceBooking | null {
    return this.serviceBookings.get(bookingId) || null;
  }

  /**
   * Buscar ServiceOrder por bookingId
   */
  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return Array.from(this.serviceOrders.values()).find(o => o.bookingId === bookingId) || null;
  }

  /**
   * Buscar ServiceOrder por orderId
   */
  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.serviceOrders.get(orderId) || null;
  }
}