// src/modules/events/events-payment.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de pagamento para eventos (ingressos)
// Integrado com Unify Bank para garantir redistribuição automática

import { bankIntegrationService } from '../bank/bank-integration.service';
import { runQueryWithTenant } from '@core/database/pool';

interface ProcessEventPaymentInput {
  tenantId: string;
  eventId: string;
  attendeeUserId: string; // Usuário que está comprando ingresso
  organizerId?: string; // Organizador do evento (se houver)
  amountCents: number;
  currency?: string;
}

interface ProcessEventPaymentResult {
  transactionIds: string[];
  splits: Array<{
    targetType: string;
    amountCents: number;
    transactionId?: string;
  }>;
}

class EventsPaymentService {
  /**
   * Processa pagamento de ingresso de evento
   * Usa Unify Bank para redistribuir automaticamente
   * 
   * Destinos típicos (via event_ticket context):
   * - Organizador: 70%
   * - Fee (plataforma): 3%
   * - Regional Fund: 10%
   * - Reserve: 17%
   */
  async processEventPayment(input: ProcessEventPaymentInput): Promise<ProcessEventPaymentResult> {
    const {
      tenantId,
      eventId,
      attendeeUserId,
      organizerId,
      amount,
      currency = 'BRL',
    } = input;

    // Processar pagamento via Unify Bank
    const result = await bankIntegrationService.processEventTicketPayment(tenantId, {
      eventId,
      buyerUserId: attendeeUserId,
      amount,
      currency: currency as any,
      metadata: {
        organizerId,
        type: 'event_ticket_purchase',
      },
    });

    // Mapear resultado para formato compatível
    return {
      transactionIds: [result.transactionId],
      splits: result.splits.map((split) => ({
        targetType: 'revenue_share', // Simplificado - detalhes estão no bank
        amountCents: split.amount,
        transactionId: result.transactionId,
      })),
    };
  }
}

export const eventsPaymentService = new EventsPaymentService();





























