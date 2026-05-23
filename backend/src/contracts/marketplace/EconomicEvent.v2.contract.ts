// CONTRATO v2 — EconomicEvent (nomenclatura canônica)
// v1: EconomicEvent.contract.ts (CONGELADO) — amountCents + currency já explícitos; v2 unifica em MoneyAmountCents opcional
// §4.7 — evita `number` sem unidade para impacto monetário.

import type { MoneyAmountCents } from './_canonical/money.types';

export type EconomicEventTypeV2 =
  | 'order_created'
  | 'order_completed'
  | 'service_booked'
  | 'subscription_started'
  | 'subscription_cycle_generated'
  | 'regional_fund_credit'
  | 'regional_fund_allocation'
  | 'new_store_opened'
  | 'industry_product_activated'
  | 'batch_executed'
  | 'company_onboarded'
  | 'service_request_created'
  | 'service_request_accepted'
  | 'bundle_service_booked'
  | 'service_pre_reservation_created'
  | 'service_pre_reservation_expired'
  | 'service_pre_reservation_confirmed'
  | 'service_dispatch_retried'
  | 'service_completed'
  | 'service_evaluation_submitted'
  | 'service_evaluation_missing'
  | 'user_low_evaluation';

/**
 * Evento económico v2: impacto monetário opcional sempre como MoneyAmountCents (não campos soltos).
 * Consumidores devem migrar de amountCents/currency paralelos para monetaryImpact.
 */
export interface EconomicEventV2 {
  eventId: string;
  type: EconomicEventTypeV2;
  region: {
    country: string;
    state: string;
    city: string;
  };
  actorId: string;
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider' | 'regional_fund';
  referenceId?: string;
  /** Quando o evento tiver montante (pedidos, alocações, etc.). */
  monetaryImpact?: MoneyAmountCents | null;
  visibility: 'public' | 'local' | 'restricted';
  displayText: string;
  createdAt: string;
}