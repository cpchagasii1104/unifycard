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
  checkoutId: string;
  orders: Array<{
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    subtotal: number;
  }>;
  totalCents: number;
  paymentOptions: {
    allowBalance: boolean;
    allowCard: boolean;
    allowInvoice: boolean;
  };
  status: 'open' | 'confirmed' | 'paid' | 'invoiced';
  attributionId?: string;
}






