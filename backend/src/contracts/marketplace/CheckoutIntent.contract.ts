// backend/src/contracts/marketplace/CheckoutIntent.contract.ts
// CONTRATO PÚBLICO CONGELADO - CheckoutIntent (Intenção de checkout multi-loja)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * CheckoutIntent - Intenção de checkout multi-loja
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
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





