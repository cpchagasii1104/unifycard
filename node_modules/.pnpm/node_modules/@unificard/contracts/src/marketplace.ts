// packages/contracts/src/marketplace.ts
// CONTRATOS PÚBLICOS DO MARKETPLACE
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Order - Pedido do Marketplace
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 */
export interface Order {
  order_id: string;
  store_id: string;
  channel: 'online' | 'physical' | 'b2b';
  origin: 'marketplace' | 'store_pdv' | 'external';
  customer_id?: string;
  items: Array<{
    product_id: string;
    name: string;
    price: {
      amount: number;
      currency: string;
    };
    quantity: number;
    subtotal: number;
  }>;
  total: number;
}

/**
 * CheckoutIntent - Intenção de checkout multi-loja
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 */
export interface CheckoutIntent {
  checkout_id: string;
  orders: Array<{
    store_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
    subtotal: number;
  }>;
  total: number;
  payment_options: {
    allow_balance: boolean;
    allow_card: boolean;
    allow_invoice: boolean;
  };
  status: 'open' | 'confirmed' | 'paid' | 'invoiced';
  attribution_id?: string;
}

/**
 * PaymentPlan - Plano de pagamento com splits
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 */
export interface PaymentPlan {
  payment_plan_id: string;
  checkout_id: string;
  method: 'balance' | 'card' | 'invoice';
  total: number;
  splits: Array<{
    type: 'seller' | 'platform' | 'affiliate' | 'regional_fund';
    target_id: string;
    amount: number;
    currency: string;
  }>;
  status: 'calculated' | 'executed';
  issued_at?: string; // B2B: data de emissão
  due_date?: string; // B2B: data de vencimento
  paid_at?: string; // B2B: data de pagamento
}

/**
 * DeliveryOrder - Ordem de entrega
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 */
export interface DeliveryOrder {
  delivery_id: string;
  checkout_id: string;
  store_id: string;
  type: 'own' | 'third_party';
  vehicle: 'bike' | 'moto' | 'car' | 'van';
  eta_minutes: number;
  cost: {
    amount: number;
    currency: string;
    payer: 'seller' | 'buyer' | 'platform';
  };
  status: 'created' | 'assigned' | 'in_transit' | 'delivered';
}

/**
 * ServiceOrder - Ordem de serviço (agendamento)
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 */
export interface ServiceOrder {
  order_id: string;
  booking_id: string;
  offering_id: string;
  price: {
    amount: number;
    currency: string;
  };
  channel: 'online';
  created_at: string;
}





