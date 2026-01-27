// backend/src/contracts/marketplace/Order.contract.ts
// CONTRATO PÚBLICO CONGELADO - Order (Pedido do Marketplace)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Order - Pedido do Marketplace
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface Order {
  order_id: string;
  store_id: string;
  channel: 'online' | 'physical' | 'b2b';
  origin: 'marketplace' | 'store_pdv' | 'external';
  customer_id?: string; // Opcional: para PDV e B2B
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

