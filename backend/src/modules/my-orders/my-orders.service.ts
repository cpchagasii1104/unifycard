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
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO (schema-ghost — tabela agreements ausente, achado ao provar esta
      // ║          fatia: quebrava a rota INTEIRA antes mesmo de chegar no fix de disputa)
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31 — mesmo padrão do evidence_packs abaixo
      // ║ NÃO:     deixar a leitura estourar sem captura.
      // ║ EM VEZ:  captura visível + agreement undefined na falha (os campos derivados de
      // ║          agreement já eram opcionais/`|| null` — honestos por construção).
      // ╚════════════════════════════════════════════════════════════════
      const { agreementRepository } = await import('../agreements/agreement.repository');
      let agreement: Awaited<ReturnType<typeof agreementRepository.list>>[number] | undefined;
      try {
        const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
        agreement = agreements.find(
          (a) => a.contextType === 'booking' && a.contextId === booking.bookingId
        );
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler agreements (schema-ghost) — agreement fica UNKNOWN', {
          tenantId, bookingId: booking.bookingId, error: err instanceof Error ? err.message : String(err),
        });
      }

      // Buscar Evidence Pack
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO (schema-ghost — tabela evidence_packs ausente, medido)
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
      // ║ NÃO:     deixar a leitura estourar sem captura — derrubaria a rota inteira (500) pra
      // ║          QUALQUER usuário com pelo menos 1 booking, hoje. NÃO criar evidence_packs
      // ║          pra acomodar esta leitura — casa ausente é schema-ghost, frente própria com
      // ║          GATE se necessário (protocolo §2.3.2).
      // ║ EM VEZ:  captura visível (log nomeando a causa) + evidencePack fica undefined —
      // ║          evidencePackId no item final já é honestamente null nesse caso.
      // ╚════════════════════════════════════════════════════════════════
      const { evidenceService } = await import('../evidence/evidence.service');
      let evidencePack: { packId: string; disputeStatus?: string } | undefined;
      try {
        const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
        evidencePack = evidencePacks.find(
          (p) => p.contextType === 'booking' && p.contextId === booking.bookingId
        );
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler evidence_packs (schema-ghost) — evidencePackId fica UNKNOWN', {
          tenantId, bookingId: booking.bookingId, error: err instanceof Error ? err.message : String(err),
        });
      }

      // Buscar Invoice (via ServiceOrder)
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO — achado ao provar esta fatia, DIFERENTE dos dois acima: invoicing é
      // ║          contenção DELIBERADA (503 INVOICE_MODULE_UNAVAILABLE, invoice.service.ts:21-41,
      // ║          "R-6 pós-YALA", fail-closed documentado), não omissão acidental. Sem captura
      // ║          aqui, esse 503 deliberado derruba o Hub INTEIRO (todo /my-orders), não só o
      // ║          campo invoice — o que este arquivo NUNCA decidiu fazer.
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
      // ║ NÃO:     deixar o 503 propagar cru — sozinho ele já é honesto (diz a causa), mas
      // ║          propagado sem captura ele apaga TODO O RESTO da agregação (agreement, trust,
      // ║          disputa) que não depende de invoice nenhuma.
      // ║ EM VEZ:  captura visível (preserva a causa no log) + invoice fica null — o resto do
      // ║          item continua honesto e disponível.
      // ╚════════════════════════════════════════════════════════════════
      let invoice = null;
      if (serviceOrder) {
        try {
          const { invoiceService } = await import('../invoicing/invoice.service');
          const invoices = await invoiceService.listInvoices(tenantId, { limit: 10000 });
          invoice = invoices.find((i) => i.serviceOrderId === serviceOrder?.id) || null;
        } catch (err) {
          console.warn('[MyOrdersService] Falha ao ler invoices (503 INVOICE_MODULE_UNAVAILABLE deliberado, invoice.service.ts) — invoice fica UNKNOWN (null), não derruba o resto do item', {
            tenantId, serviceOrderId: serviceOrder?.id, error: err instanceof Error ? err.message : String(err),
          });
        }
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
        console.warn('[MyOrdersService] Falha ao ler trust profile — trustScore/riskLevel ficam UNKNOWN (null)', {
          tenantId, actorId: booking.requesterActorId, error: err instanceof Error ? err.message : String(err),
        });
      }

      // Verificar disputa aberta
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CANÔNICO
      // ║ NORMA:   service-order.types.ts:101 (ServiceOrder.disputedAt) — a mesma fonte que
      // ║          `release_approved` já exige NULL para liberar (F-DISPUTE-SIGNAL, 2026-07-31)
      // ║ NÃO:     evidencePack?.disputeStatus — schema-ghost (tabela ausente), sinal morto.
      // ║ EM VEZ:  serviceOrder.disputedAt (contexto TEM service_order aqui — so/serviceOrder já
      // ║          buscado acima, sempre não-nulo neste bloco).
      // ╚════════════════════════════════════════════════════════════════
      const hasOpenDispute = serviceOrder.disputedAt != null;

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
        console.warn('[MyOrdersService] Falha ao ler service — serviceName fica UNKNOWN (null)', {
          tenantId, serviceId: booking.serviceId, error: err instanceof Error ? err.message : String(err),
        });
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
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO (schema-ghost — tabela agreements ausente, achado ao provar esta fatia)
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
      // ║ NÃO:     deixar a leitura estourar sem captura.
      // ║ EM VEZ:  captura visível + agreement undefined na falha.
      // ╚════════════════════════════════════════════════════════════════
      const { agreementRepository } = await import('../agreements/agreement.repository');
      let agreement: Awaited<ReturnType<typeof agreementRepository.list>>[number] | undefined;
      try {
        const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
        agreement = agreements.find(
          (a) => a.contextType === 'service' && a.contextId === so.id
        );
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler agreements (schema-ghost) — agreement fica UNKNOWN', {
          tenantId, serviceOrderId: so.id, error: err instanceof Error ? err.message : String(err),
        });
      }

      // Buscar Evidence Pack
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO (schema-ghost — tabela evidence_packs ausente, medido)
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
      // ║ NÃO:     deixar a leitura estourar sem captura — derrubaria a rota inteira (500).
      // ║          NÃO criar evidence_packs — schema-ghost, frente própria com GATE.
      // ║ EM VEZ:  captura visível + evidencePack undefined na falha (evidencePackId vira
      // ║          null honestamente).
      // ╚════════════════════════════════════════════════════════════════
      const { evidenceService } = await import('../evidence/evidence.service');
      let evidencePack: { packId: string; disputeStatus?: string } | undefined;
      try {
        const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
        evidencePack = evidencePacks.find(
          (p) => p.contextType === 'service_order' && p.contextId === so.id
        );
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler evidence_packs (schema-ghost) — evidencePackId fica UNKNOWN', {
          tenantId, serviceOrderId: so.id, error: err instanceof Error ? err.message : String(err),
        });
      }

      // Buscar Invoice
      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO — mesmo achado do bloco de booking acima: invoicing é contenção
      // ║          DELIBERADA (503 INVOICE_MODULE_UNAVAILABLE), não omissão acidental.
      // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
      // ║ EM VEZ:  captura visível + invoice fica undefined — resto do item continua honesto.
      // ╚════════════════════════════════════════════════════════════════
      const { invoiceService } = await import('../invoicing/invoice.service');
      let invoice: Awaited<ReturnType<typeof invoiceService.listInvoices>>[number] | undefined;
      try {
        const invoices = await invoiceService.listInvoices(tenantId, { limit: 10000 });
        invoice = invoices.find((i) => i.serviceOrderId === so.id);
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler invoices (503 INVOICE_MODULE_UNAVAILABLE deliberado) — invoice fica UNKNOWN, não derruba o resto do item', {
          tenantId, serviceOrderId: so.id, error: err instanceof Error ? err.message : String(err),
        });
      }

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
        console.warn('[MyOrdersService] Falha ao ler trust profile — trustScore/riskLevel ficam UNKNOWN (null)', {
          tenantId, actorId: so.customerActorId, error: err instanceof Error ? err.message : String(err),
        });
      }

      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CANÔNICO
      // ║ NORMA:   service-order.types.ts:101 (ServiceOrder.disputedAt) — F-DISPUTE-SIGNAL, 2026-07-31
      // ║ NÃO:     evidencePack?.disputeStatus — schema-ghost (tabela ausente), sinal morto.
      // ║ EM VEZ:  so.disputedAt (contexto TEM service_order aqui — `so` sempre não-nulo).
      // ╚════════════════════════════════════════════════════════════════
      const hasOpenDispute = so.disputedAt != null;

      // Determinar status (disputa tem prioridade — achado ao provar a fatia: este bloco
      // calculava hasOpenDispute mas NUNCA o usava pra status, ao contrário dos blocos de
      // booking/RFQ; sem isto a prova exigida — "ordem com disputed_at mostra status=disputed"
      // — não se sustenta para service_order direto).
      let status: MyOrderItem['status'] = 'negotiation';
      if (hasOpenDispute) {
        status = 'disputed';
      } else if (so.status === 'completed') {
        status = 'completed';
      } else if (so.status === 'in_progress') {
        status = 'in_execution';
      } else if (so.status === 'cancelled') {
        status = 'cancelled';
      } else if (so.status === 'confirmed') {
        status = agreement?.status === 'finalized' ? 'agreement_finalized' : 'negotiation';
      }

      // Buscar informações do serviço
      let serviceName: string | null = null;
      try {
        const { servicesRepository } = await import('../services/services.repository');
        const service = await servicesRepository.findById(tenantId, so.serviceId);
        serviceName = service?.name || null;
      } catch (err) {
        console.warn('[MyOrdersService] Falha ao ler service — serviceName fica UNKNOWN (null)', {
          tenantId, serviceId: so.serviceId, error: err instanceof Error ? err.message : String(err),
        });
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
        // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
        // ║ STATUS:  CONTIDO (schema-ghost — tabela agreements ausente, achado ao provar esta fatia)
        // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
        // ║ NÃO:     deixar a leitura estourar sem captura.
        // ║ EM VEZ:  captura visível + agreement undefined na falha.
        // ╚════════════════════════════════════════════════════════════════
        const { agreementRepository } = await import('../agreements/agreement.repository');
        let agreement: Awaited<ReturnType<typeof agreementRepository.list>>[number] | undefined;
        try {
          const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
          agreement = agreements.find(
            (a) => a.contextType === 'rfq' && a.contextId === rfq.rfqId
          );
        } catch (err) {
          console.warn('[MyOrdersService] Falha ao ler agreements (schema-ghost) — agreement fica UNKNOWN', {
            tenantId, rfqId: rfq.rfqId, error: err instanceof Error ? err.message : String(err),
          });
        }

        // Buscar Evidence Pack
        // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
        // ║ STATUS:  CONTIDO (schema-ghost — tabela evidence_packs ausente, medido)
        // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31
        // ║ NÃO:     este bloco (RFQ/event) NÃO tem service_order — não dá pra compor de
        // ║          service_orders.disputed_at (norma service-order.types.ts:101) sem inventar
        // ║          um mapeamento que não existe; PAREI aqui por instrução explícita do pacote
        // ║          (item 0: "se algum contexto NÃO tiver service_order, PARE e reporte"). NÃO
        // ║          criar evidence_packs — schema-ghost, frente própria com GATE.
        // ║ EM VEZ:  captura visível + hasOpenDispute fica undefined (desconhecido) na falha —
        // ║          nunca false. Este é o único dos 4 sítios de hasOpenDispute desta fatia que
        // ║          segue sem fonte governada — reportado à direção, não resolvido aqui.
        // ╚════════════════════════════════════════════════════════════════
        const { evidenceService } = await import('../evidence/evidence.service');
        let evidencePack: { packId: string; disputeStatus?: string } | undefined;
        let hasOpenDispute: boolean | undefined;
        try {
          const evidencePacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
          evidencePack = evidencePacks.find(
            (p) => p.contextType === 'event' && p.contextId === event.id
          );
          hasOpenDispute = evidencePack?.disputeStatus === 'OPEN';
        } catch (err) {
          console.warn('[MyOrdersService] Falha ao ler evidence_packs (schema-ghost) — hasOpenDispute/evidencePackId ficam UNKNOWN, nunca false', {
            tenantId, eventId: event.id, error: err instanceof Error ? err.message : String(err),
          });
        }

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

