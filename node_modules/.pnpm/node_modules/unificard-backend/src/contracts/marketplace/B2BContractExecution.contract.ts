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
  execution_id: string;
  contract_id: string;
  order_id: string; // Order gerado para esta execução
  payment_plan_id: string; // PaymentPlan executado
  products: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  total_amount: number;
  currency: string;
  delivery_date: string; // Data prevista de entrega
  payment_due_date: string; // Data de vencimento do pagamento
  penalty_applied?: number; // Multa aplicada (se houver atraso)
  status: 'pending' | 'delivered' | 'paid' | 'overdue' | 'penalized';
  executed_at: string;
  delivered_at?: string;
  paid_at?: string;
  // NÃO incluir updated_at - execução é imutável após criação
}





