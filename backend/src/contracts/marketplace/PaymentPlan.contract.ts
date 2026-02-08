// backend/src/contracts/marketplace/PaymentPlan.contract.ts
// CONTRATO PÚBLICO CONGELADO - PaymentPlan (Plano de pagamento com splits)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * PaymentPlan - Plano de pagamento com splits
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface PaymentPlan {
  paymentPlanId: string;
  checkoutId: string;
  method: 'balance' | 'card' | 'invoice';
  totalCents: number;
  splits: Array<{
    type: 'seller' | 'platform' | 'affiliate' | 'regional_fund' | 'industry' | 'hub';
    targetId: string;
    amountCents: number;
    currency: string;
  }>;
  status: 'calculated' | 'executed';
  issuedAt?: string; // B2B: data de emissão
  dueDate?: string; // B2B: data de vencimento
  paidAt?: string; // B2B: data de pagamento
}


