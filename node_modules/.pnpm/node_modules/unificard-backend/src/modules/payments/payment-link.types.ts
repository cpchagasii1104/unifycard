// backend/src/modules/payments/payment-link.types.ts
// SPRINT 86: PAYMENT LINKS

/**
 * Status do payment link
 */
export type PaymentLinkStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED';

/**
 * Status do pagamento via link
 */
export type PaymentLinkPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/**
 * PaymentLink
 */
export interface PaymentLink {
  id: string;
  tenantId: string;
  createdByActorId: string;
  slug: string;
  title: string;
  description: string | null;
  amountCents: number;
  currency: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usesCount: number;
  status: PaymentLinkStatus;
  contactId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar payment link
 */
export interface CreatePaymentLinkInput {
  title: string;
  description?: string;
  amountCents: number;
  currency?: string;
  expiresAt?: Date;
  maxUses?: number;
  contactId?: string;
  metadata?: Record<string, any>;
}

/**
 * PaymentLinkPayment (append-only)
 */
export interface PaymentLinkPayment {
  id: string;
  tenantId: string;
  paymentLinkId: string;
  paymentIntentId: string;
  paymentTransactionId: string | null;
  contactId: string | null;
  status: PaymentLinkPaymentStatus;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}







