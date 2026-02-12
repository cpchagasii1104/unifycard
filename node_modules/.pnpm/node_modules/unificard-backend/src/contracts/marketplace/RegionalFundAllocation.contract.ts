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
  allocationId: string;
  regionalFundId: string;
  type: 'subsidy' | 'incentive' | 'reimbursement' | 'infrastructure';
  targetActorId: string; // ID do ator que recebe a alocação
  targetActorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  reference?: {
    orderId?: string;
    subscriptionId?: string;
    projectId?: string;
    deliveryId?: string;
  };
  amountCents: number;
  currency: string;
  reason: string; // Motivo determinístico da alocação
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  ledgerEntryId?: string; // ID do lançamento no ledger (quando executado)
  createdAt: string;
  executedAt?: string;
  // NÃO incluir updatedAt - alocações são imutáveis após criação
}





