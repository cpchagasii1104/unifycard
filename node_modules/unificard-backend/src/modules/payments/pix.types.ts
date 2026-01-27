// backend/src/modules/payments/pix.types.ts
// SPRINT 85: PIX INTEGRATION

/**
 * PixCharge
 */
export interface PixCharge {
  id: string;
  tenantId: string;
  paymentIntentId: string;
  provider: string;
  providerChargeId: string;
  amount: number; // em centavos
  currency: string;
  status: 'CREATED' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  expiresAt: Date;
  paidAt: Date | null;
  payloadSnapshot: Record<string, any>; // QR Code, copia-e-cola, etc.
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar PixCharge
 */
export interface CreatePixChargeInput {
  paymentIntentId: string;
  amount: number; // em centavos
  currency?: string;
  expiresInMinutes?: number;
  payerTaxId?: string;
  payerName?: string;
  metadata?: Record<string, any>;
}

/**
 * PixWebhookEvent
 */
export interface PixWebhookEvent {
  id: string;
  tenantId: string;
  provider: string;
  providerEventId: string;
  pixChargeId: string | null;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  rawPayload: Record<string, any>;
  receivedAt: Date;
  processedAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}





