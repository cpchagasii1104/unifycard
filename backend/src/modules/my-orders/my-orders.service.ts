// backend/src/modules/my-orders/my-orders.service.ts
// My Orders Service - Agregação de pedidos do comprador
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Backend é única fonte de verdade

import type { MyOrderItem, MyOrdersFilters, MyOrdersStats } from './my-orders.types';

class MyOrdersService {
  /**
   * Lista todos os pedidos do comprador (agregado)
   * 🔴 BLINDAGEM: Consolida dados de múltiplas fontes canônicas
   */
  async listMyOrders(
    tenantId: string,
    requesterActorId: string,
    filters: MyOrdersFilters = {}
  ): Promise<MyOrderItem[]> {
    const orders: MyOrderItem[] = [];

    // 1. Buscar Service Orders com booking (tratados como "bookings" para exibição)
    const { serviceOrderRepository } = await import('../services/service-order.repository');
    const ordersWithBooking = await serviceOrderRepository.listOrders(tenantId, {
      customerActorId: requesterActorId,
      limit: 10000,
    });
    const bookingsFromOrders = ordersWithBooking.filter((so) => so.bookingId != null);

    for (const so of bookingsFromOrders) {
      const booking = {
        bookingId: so.bookingId as string,
        serviceId: so.serviceId,
        requesterActorId: so.customerActorId,
        status: so.status,
        metadata: so.metadata,
      };
      const serviceOrder = so;
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
      const agreement = agreements.find(
        (a) => a.contextType === 'booking' && a.contextId === booking.bookingId
      );

      // Buscar Evidence Pack
      const { evidenceService } = await import('../evidence/evidence.service');
      const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
      const evidencePack = evidencePacks.find(
        (p) => p.contextType === 'booking' && p.contextId === booking.bookingId
      );

      // Buscar Invoice (via ServiceOrder)
      let invoice = null;
      if (serviceOrder) {
        const { invoiceService } = await import('../invoicing/invoice.service');
        const invoices = await invoiceService.listInvoices(tenantId, { limit: 10000 });
        invoice = invoices.find((i) => i.serviceOrderId === serviceOrder?.id);
      }

      // Buscar Trust Profile
      let trustScore: number | null = null;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null = null;
      try {
        const { trustRepository } = await import('../trust/trust.repository');
        const trustProfile = await trustRepository.findByActor(tenantId, booking.requesterActorId);
        if (trustProfile) {
          trustScore = trustProfile.currentScore;
          riskLevel = trustProfile.riskLevel;
        }
      } catch (err) {
        // Ignorar erro
      }

      // Verificar disputa aberta
      const hasOpenDispute = evidencePack?.disputeStatus === 'OPEN';

      // Determinar status consolidado
      let status: MyOrderItem['status'] = 'negotiation';
      if (hasOpenDispute) {
        status = 'disputed';
      } else if (serviceOrder) {
        if (serviceOrder.status === 'completed') {
          status = 'completed';
        } else if (serviceOrder.status === 'in_progress') {
          status = 'in_execution';
        } else if (serviceOrder.status === 'cancelled') {
          status = 'cancelled';
        } else if (serviceOrder.status === 'confirmed') {
          status = agreement?.status === 'finalized' ? 'agreement_finalized' : 'negotiation';
        }
      } else if (booking.status === 'cancelled') {
        status = 'cancelled';
      } else if (agreement?.status === 'finalized') {
        status = 'agreement_finalized';
      }

      // Buscar informações do serviço
      let serviceName: string | null = null;
      try {
        const { servicesRepository } = await import('../services/services.repository');
        const service = await servicesRepository.findById(tenantId, booking.serviceId);
        serviceName = service?.name || null;
      } catch (err) {
        // Ignorar erro
      }

      orders.push({
        orderId: booking.bookingId,
        orderType: 'booking',
        status,
        serviceId: booking.serviceId,
        serviceName,
        eventId: booking.metadata?.eventId || null,
        eventName: booking.metadata?.eventName || null,
        agreedPriceCents: agreement?.priceCents || null,
        currency: agreement?.currency || 'BRL',
        createdAt: so.createdAt,
        updatedAt: so.updatedAt,
        scheduledStart: serviceOrder?.scheduledStart ?? null,
        scheduledEnd: serviceOrder?.scheduledEnd || null,
        completedAt: serviceOrder?.completedAt || null,
        bookingId: booking.bookingId,
        serviceOrderId: serviceOrder?.id || null,
        rfqId: booking.metadata?.rfqId || null,
        agreementId: agreement?.agreementId || null,
        threadId: agreement?.threadId || null,
        evidencePackId: evidencePack?.packId || null,
        invoiceId: invoice?.invoiceId || null,
        hasOpenDispute,
        trustScore,
        riskLevel,
        metadata: booking.metadata,
      });
    }

    // 2. Buscar Service Orders diretos (sem booking)
    const serviceOrders = await serviceOrderRepository.listOrders(tenantId, {
      customerActorId: requesterActorId,
      limit: 1000,
    });

    for (const so of serviceOrders) {
      // Verificar se já foi adicionado via booking
      if (orders.some((o) => o.serviceOrderId === so.id)) {
        continue;
      }

      // Buscar Agreement
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
      const agreement = agreements.find(
        (a) => a.contextType === 'service' && a.contextId === so.id
      );

      // Buscar Evidence Pack
      const { evidenceService } = await import('../evidence/evidence.service');
      const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
      const evidencePack = evidencePacks.find(
        (p) => p.contextType === 'service_order' && p.contextId === so.id
      );

      // Buscar Invoice
      const { invoiceService } = await import('../invoicing/invoice.service');
      const invoices = await invoiceService.listInvoices(tenantId, { limit: 10000 });
      const invoice = invoices.find((i) => i.serviceOrderId === so.id);

      // Buscar Trust Profile
      let trustScore: number | null = null;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null = null;
      try {
        const { trustRepository } = await import('../trust/trust.repository');
        const trustProfile = await trustRepository.findByActor(tenantId, so.customerActorId);
        if (trustProfile) {
          trustScore = trustProfile.currentScore;
          riskLevel = trustProfile.riskLevel;
        }
      } catch (err) {
        // Ignorar erro
      }

      // Determinar status
      let status: MyOrderItem['status'] = 'negotiation';
      if (so.status === 'completed') {
        status = 'completed';
      } else if (so.status === 'in_progress') {
        status = 'in_execution';
      } else if (so.status === 'cancelled') {
        status = 'cancelled';
      } else if (so.status === 'confirmed') {
        status = agreement?.status === 'finalized' ? 'agreement_finalized' : 'negotiation';
      }

      const hasOpenDispute = evidencePack?.disputeStatus === 'OPEN';

      // Buscar informações do serviço
      let serviceName: string | null = null;
      try {
        const { servicesRepository } = await import('../services/services.repository');
        const service = await servicesRepository.findById(tenantId, so.serviceId);
        serviceName = service?.name || null;
      } catch (err) {
        // Ignorar erro
      }

      orders.push({
        orderId: so.id,
        orderType: 'service_order',
        status,
        serviceId: so.serviceId,
        serviceName,
        eventId: so.metadata?.eventId || null,
        eventName: so.metadata?.eventName || null,
        agreedPriceCents: agreement?.priceCents || null,
        currency: agreement?.currency || 'BRL',
        createdAt: so.createdAt,
        updatedAt: so.updatedAt,
        scheduledStart: so.scheduledStart,
        scheduledEnd: so.scheduledEnd,
        completedAt: so.completedAt,
        bookingId: so.bookingId,
        serviceOrderId: so.id,
        rfqId: so.metadata?.rfqId || null,
        agreementId: agreement?.agreementId || null,
        threadId: agreement?.threadId || null,
        evidencePackId: evidencePack?.packId || null,
        invoiceId: invoice?.invoiceId || null,
        hasOpenDispute,
        trustScore,
        riskLevel,
        metadata: so.metadata,
      });
    }

    // 3. Buscar RFQs
    const { eventRepository } = await import('../events/event.repository');
    const events = await eventRepository.listEvents(tenantId, { limit: 10000 });
    
    for (const event of events) {
      if (event.organizerActorId !== requesterActorId) continue;
      
      const rfqs = (event.metadata?.rfqs as any[]) || [];
      for (const rfq of rfqs) {
        if (rfq.status !== 'open' && rfq.status !== 'closed') continue;

        // Buscar Agreement relacionado
        const { agreementRepository } = await import('../agreements/agreement.repository');
        const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
        const agreement = agreements.find(
          (a) => a.contextType === 'rfq' && a.contextId === rfq.rfqId
        );

        // Buscar Evidence Pack
        const { evidenceService } = await import('../evidence/evidence.service');
        const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
        const evidencePack = evidencePacks.find(
          (p) => p.contextType === 'event' && p.contextId === event.id
        );

        const hasOpenDispute = evidencePack?.disputeStatus === 'OPEN';

        // Determinar status (disputa tem prioridade)
        let status: MyOrderItem['status'] = 'negotiation';
        if (hasOpenDispute) {
          status = 'disputed';
        } else if (agreement?.status === 'finalized') {
          status = 'agreement_finalized';
        } else if (rfq.status === 'closed') {
          status = 'cancelled';
        }

        orders.push({
          orderId: rfq.rfqId,
          orderType: 'rfq',
          status,
          serviceId: null,
          serviceName: null,
          eventId: event.id,
          eventName: event.title,
          agreedPriceCents: agreement?.priceCents || null,
          currency: agreement?.currency || 'BRL',
          createdAt: (() => {
            const d = rfq.createdAt ?? event.createdAt;
            return typeof d === 'string' ? d : new Date(d as number | Date).toISOString();
          })(),
          updatedAt: (() => {
            const d = rfq.updatedAt ?? event.updatedAt;
            return typeof d === 'string' ? d : new Date(d as number | Date).toISOString();
          })(),
          scheduledStart: event.startAt || null,
          scheduledEnd: event.endAt || null,
          completedAt: null,
          bookingId: null,
          serviceOrderId: null,
          rfqId: rfq.rfqId,
          agreementId: agreement?.agreementId || null,
          threadId: agreement?.threadId || null,
          evidencePackId: evidencePack?.packId || null,
          invoiceId: null,
          hasOpenDispute,
          trustScore: null,
          riskLevel: null,
          metadata: { eventId: event.id, rfq },
        });
      }
    }

    // Aplicar filtros
    let filtered = orders;
    if (filters.orderType) {
      filtered = filtered.filter((o) => o.orderType === filters.orderType);
    }
    if (filters.status) {
      filtered = filtered.filter((o) => o.status === filters.status);
    }
    if (filters.startDate) {
      filtered = filtered.filter((o) => new Date(o.createdAt) >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter((o) => new Date(o.createdAt) <= filters.endDate!);
    }
    if (filters.hasOpenDispute !== undefined) {
      filtered = filtered.filter((o) => o.hasOpenDispute === filters.hasOpenDispute);
    }

    // Ordenar por data de atualização (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Aplicar paginação
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Calcula estatísticas do My Orders Hub
   */
  async getMyOrdersStats(
    tenantId: string,
    requesterActorId: string
  ): Promise<MyOrdersStats> {
    const orders = await this.listMyOrders(tenantId, requesterActorId, { limit: 10000 });

    const ordersByStatus: Record<string, number> = {
      negotiation: 0,
      agreement_finalized: 0,
      in_execution: 0,
      completed: 0,
      cancelled: 0,
      disputed: 0,
    };

    const ordersByType: Record<string, number> = {
      rfq: 0,
      booking: 0,
      service_order: 0,
      agreement: 0,
      bundle: 0,
    };

    let totalValueCents = 0;
    let openDisputes = 0;

    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
      
      if (order.agreedPriceCents) {
        totalValueCents += order.agreedPriceCents;
      }
      
      if (order.hasOpenDispute) {
        openDisputes++;
      }
    }

    return {
      totalOrders: orders.length,
      ordersByStatus: ordersByStatus as Record<MyOrderItem['status'], number>,
      ordersByType: ordersByType as Record<MyOrderItem['orderType'], number>,
      totalValueCents,
      currency: 'BRL',
      openDisputes,
    };
  }
}

export const myOrdersService = new MyOrdersService();

