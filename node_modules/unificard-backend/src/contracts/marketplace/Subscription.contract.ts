// backend/src/contracts/marketplace/Subscription.contract.ts
// CONTRATO PÚBLICO CONGELADO - Subscription (Assinatura/Recorrência)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Subscription - Assinatura/Recorrência do Marketplace
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface Subscription {
  subscription_id: string;
  type: 'product' | 'service' | 'mixed';
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  start_date: string; // YYYY-MM-DD
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  linked_entities: {
    products?: Array<{
      product_id: string;
      store_id: string;
      quantity: number;
    }>;
    service_offerings?: Array<{
      offering_id: string;
      store_id: string;
      quantity: number;
    }>;
  };
  customer_id: string;
  store_id: string;
  payment_method: 'balance' | 'card' | 'invoice';
  attribution_id?: string; // Opcional: se subscription veio de share
  created_at: string;
  updated_at: string;
  cancelled_at?: string; // Data de cancelamento (não retroativo)
  expires_at?: string; // Data de expiração (se houver)
}

/**
 * SubscriptionCycle - Ciclo de cobrança de uma assinatura
 * 
 * Cada ciclo gera um PaymentPlan novo
 */
export interface SubscriptionCycle {
  cycle_id: string;
  subscription_id: string;
  cycle_number: number; // 1, 2, 3, ...
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: 'pending' | 'billed' | 'paid' | 'failed';
  order_id?: string; // Order gerado para este ciclo
  checkout_id?: string; // Checkout gerado para este ciclo
  payment_plan_id?: string; // PaymentPlan gerado para este ciclo
  invoice_issued_at?: string; // B2B: data de emissão
  invoice_due_date?: string; // B2B: data de vencimento
  invoice_paid_at?: string; // B2B: data de pagamento
  created_at: string;
}





