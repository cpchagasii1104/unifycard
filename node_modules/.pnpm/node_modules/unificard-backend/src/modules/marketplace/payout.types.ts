// backend/src/modules/marketplace/payout.types.ts
// SPRINT 40.2: MARKETPLACE EXECUÇÃO - Payout Real
// Tipos para execuções de payout

/**
 * Status do payout
 */
export type PayoutTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Payout Transaction
 * Executa repasse financeiro baseado em um split declarado
 */
export interface PayoutTransaction {
  id: string;
  tenantId: string;
  paymentIntentId: string;
  paymentSplitId: string;
  recipientActorId: string;
  bankTransactionId?: string | null;
  amount: number;
  currency: string;
  status: PayoutTransactionStatus;
  errorCode?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para executar payout
 */
export interface ExecutePayoutInput {
  paymentIntentId: string;
  actingUserId?: string;
}







