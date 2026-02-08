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
  subscriptionId: string;
  type: 'product' | 'service' | 'mixed';
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  startDate: string; // YYYY-MM-DD
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  linkedEntities: {
    products?: Array<{
      productId: string;
      storeId: string;
      quantity: number;
    }>;
    serviceOfferings?: Array<{
      offeringId: string;
      storeId: string;
      quantity: number;
    }>;
  };
  customerId: string;
  storeId: string;
  paymentMethod: 'balance' | 'card' | 'invoice';
  attributionId?: string; // Opcional: se subscription veio de share
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string; // Data de cancelamento (não retroativo)
  expiresAt?: string; // Data de expiração (se houver)
}

/**
 * SubscriptionCycle - Ciclo de cobrança de uma assinatura
 * 
 * Cada ciclo gera um PaymentPlan novo
 */
export interface SubscriptionCycle {
  cycleId: string;
  subscriptionId: string;
  cycleNumber: number; // 1, 2, 3, ...
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'pending' | 'billed' | 'paid' | 'failed';
  orderId?: string; // Order gerado para este ciclo
  checkoutId?: string; // Checkout gerado para este ciclo
  paymentPlanId?: string; // PaymentPlan gerado para este ciclo
  invoiceIssuedAt?: string; // B2B: data de emissão
  invoiceDueDate?: string; // B2B: data de vencimento
  invoicePaidAt?: string; // B2B: data de pagamento
  createdAt: string;
}





