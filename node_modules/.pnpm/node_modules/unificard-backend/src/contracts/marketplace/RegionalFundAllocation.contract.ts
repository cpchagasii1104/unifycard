// backend/src/contracts/marketplace/RegionalFundAllocation.contract.ts
// CONTRATO PÚBLICO CONGELADO - RegionalFundAllocation (Alocação do Fundo Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RegionalFundAllocation - Alocação de recursos do Fundo Regional
 * 
 * Nenhum dinheiro sai sem allocation explícita.
 * Cada alocação é registrada no ledger imutável.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface RegionalFundAllocation {
  allocation_id: string;
  regional_fund_id: string;
  type: 'subsidy' | 'incentive' | 'reimbursement' | 'infrastructure';
  target_actor_id: string; // ID do ator que recebe a alocação
  target_actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  reference?: {
    order_id?: string;
    subscription_id?: string;
    project_id?: string;
    delivery_id?: string;
  };
  amount: number;
  currency: string;
  reason: string; // Motivo determinístico da alocação
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  ledger_entry_id?: string; // ID do lançamento no ledger (quando executado)
  created_at: string;
  executed_at?: string;
  // NÃO incluir updated_at - alocações são imutáveis após criação
}





