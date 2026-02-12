// backend/src/contracts/marketplace/B2BContractExecution.contract.ts
// CONTRATO PÚBLICO CONGELADO - B2BContractExecution (Execução de Contrato B2B)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * B2BContractExecution - Execução de Contrato Comercial B2B
 * 
 * Execução via PaymentPlan
 * Registro imutável de cada execução
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface B2BContractExecution {
  executionId: string;
  contractId: string;
  orderId: string; // Order gerado para esta execução
  paymentPlanId: string; // PaymentPlan executado
  products: Array<{
    productId: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  totalAmountCents: number;
  currency: string;
  deliveryDate: string; // Data prevista de entrega
  paymentDueDate: string; // Data de vencimento do pagamento
  penaltyAppliedCents?: number; // Multa aplicada (se houver atraso)
  status: 'pending' | 'delivered' | 'paid' | 'overdue' | 'penalized';
  executedAt: string;
  deliveredAt?: string;
  paidAt?: string;
  // NÃO incluir updatedAt - execução é imutável após criação
}





