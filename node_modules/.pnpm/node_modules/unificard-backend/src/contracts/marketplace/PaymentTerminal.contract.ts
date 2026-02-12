// backend/src/contracts/marketplace/PaymentTerminal.contract.ts
// CONTRATO PÚBLICO CONGELADO - PaymentTerminal (Maquininha de Pagamento)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * PaymentTerminal - Maquininha de Pagamento
 * 
 * Sistema de maquininhas integrado ao ecossistema.
 * Taxas sempre passam pelo sistema e são registradas no ledger.
 * Parte das taxas vai para Fundo Regional, Plataforma, Indicação.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface PaymentTerminal {
  terminalId: string;
  companyId: string;
  terminalType: 'unified_card' | 'external';
  provider?: string; // Cielo, Stone, etc. (se external)
  status: 'requested' | 'approved' | 'active' | 'suspended' | 'cancelled';
  // Taxas (sempre registradas no ledger)
  transactionFeeStructure: {
    baseRate: number; // Taxa base (%)
    regionalFundPercentage: number; // % da taxa que vai para Fundo Regional
    platformPercentage: number; // % da taxa que vai para Plataforma
    referralPercentage?: number; // % da taxa que vai para Indicação/Grupo
  };
  // Limites
  monthlyTransactionLimit?: number; // Limite mensal (se aplicável)
  // Timestamps
  requestedAt: string;
  approvedAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}





