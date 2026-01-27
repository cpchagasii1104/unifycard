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
  payment_plan_id: string;
  checkout_id: string;
  method: 'balance' | 'card' | 'invoice';
  total: number;
  splits: Array<{
    type: 'seller' | 'platform' | 'affiliate' | 'regional_fund' | 'industry' | 'hub';
    target_id: string;
    amount: number;
    currency: string;
  }>;
  status: 'calculated' | 'executed';
  issued_at?: string; // B2B: data de emissão
  due_date?: string; // B2B: data de vencimento
  paid_at?: string; // B2B: data de pagamento
}

