// CONTRATO v2 — CheckoutIntent (nomenclatura canônica)
// v1: CheckoutIntent.contract.ts (CONGELADO) — unitPrice/subtotal como number ambíguo
// §4.7 — linhas e subtotais em centavos.

import type { MoneyAmountCents } from './_canonical/money.types';

export interface CheckoutIntentV2 {
  checkoutId: string;
  orders: Array<{
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: MoneyAmountCents;
      /** quantity * unitPrice.amountCents, mesma moeda que unitPrice. */
      lineSubtotalCents: number;
    }>;
    /** Soma das linhas da loja (centavos); currency igual às linhas. */
    orderSubtotalCents: number;
    orderCurrency: string;
  }>;
  totalCents: number;
  checkoutCurrency: string;
  paymentOptions: {
    allowBalance: boolean;
    allowCard: boolean;
    allowInvoice: boolean;
  };
  status: 'open' | 'confirmed' | 'paid' | 'invoiced';
  attributionId?: string;
  paidAt?: string;
  createdAt?: string;
}