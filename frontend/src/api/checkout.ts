// src/api/checkout.ts
// 🔴 CRÍTICO: Apenas envia intenções, nunca calcula valores
import { CheckoutEventTicketInput, CheckoutResult } from '@unificard/contracts';
import { apiFetch } from './client';

// Tipo de resposta da API (extende CheckoutResult com campos específicos de ticket)
export interface CheckoutTicketResponse extends CheckoutResult {
  ticketId: string;
  qrCode: string;
  price: number | null;
}

export interface CheckoutConsumptionItem {
  name: string;
  quantity: number;
  price: number;
}

// Tipo de resposta da API (extende CheckoutResult com campos específicos de consumo)
export interface CheckoutConsumptionResponse extends CheckoutResult {
  consumptions: Array<{
    id: string;
    itemName: string | null;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  totalAmount: number;
}

/**
 * Checkout de ingresso
 * 🔴 Frontend não calcula valores, apenas envia intenção
 *
 * Etapa 1.7 — rerrota: usa caminho canônico POST /api/events/:id/checkout
 * (eventEconomyService → bank-integration → bankSplitEngine: motor F9 fundacional).
 * Caminho /api/checkout/event-ticket é vestígio histórico (paradigma de event_tickets
 * com qrCode/global_user_id), preservado mas inalcançável após schema convergir.
 */
export async function checkoutTicket(
  input: CheckoutEventTicketInput & { attendeeActorId: string }
): Promise<CheckoutTicketResponse> {
  const response = await apiFetch(`/api/events/${input.eventId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      attendee_actor_id: input.attendeeActorId,
      quantity: 1,
    }),
  });
  const body = await response.json();
  // Caminho B retorna { checkout: { event_id, attendee_id, transaction_id, total_amount_cents, splits } }
  // Normaliza para shape esperado pelo consumidor (EventCheckout) — qrCode/ticketId não emergem
  // do caminho canônico atual; preservados como vazios.
  const c = body?.checkout ?? body;
  return {
    success: true,
    ticketId: c?.attendee_id ?? '',
    qrCode: '',
    price: typeof c?.total_amount_cents === 'number' ? c.total_amount_cents : null,
    transactionId: c?.transaction_id,
  } as CheckoutTicketResponse;
}

/**
 * Checkout de consumo
 * 🔴 Frontend não calcula valores, apenas envia intenção
 * Backend calcula total e processa pagamento
 */
export async function checkoutConsumption(
  eventId: string,
  items: CheckoutConsumptionItem[]
): Promise<CheckoutConsumptionResponse> {
  const response = await apiFetch('/api/checkout/event-consumption', {
    method: 'POST',
    body: JSON.stringify({ eventId, items }),
  });
  return response.json();
}




