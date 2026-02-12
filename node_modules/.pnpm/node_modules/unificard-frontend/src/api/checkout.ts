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
 */
export async function checkoutTicket(
  input: CheckoutEventTicketInput
): Promise<CheckoutTicketResponse> {
  const response = await apiFetch('/api/checkout/event-ticket', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
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




