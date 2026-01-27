// backend/src/modules/marketplace/external-payment-provider.types.ts
// Tipos para provedores de pagamento externo (card, pix)

export type ExternalPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface ExternalChargeResult {
  external_payment_id: string;
  status: ExternalPaymentStatus;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface CreateExternalChargeInput {
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}





