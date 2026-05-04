// backend/src/modules/marketplace/payment-transaction.repository.ts
// Stub: repositório de transações de pagamento (migrado para Bank / em construção)
// Export mínimo para permitir import em payment-link.routes até implementação definitiva.

export interface PaymentTransactionRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  status: string;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const paymentTransactionRepository = {
  async listTransactionsByIntent(
    _tenantId: string,
    _paymentIntentId: string
  ): Promise<PaymentTransactionRow[]> {
    return [];
  },
};

export { paymentTransactionRepository };