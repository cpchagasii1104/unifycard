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
  terminal_id: string;
  company_id: string;
  terminal_type: 'unified_card' | 'external';
  provider?: string; // Cielo, Stone, etc. (se external)
  status: 'requested' | 'approved' | 'active' | 'suspended' | 'cancelled';
  // Taxas (sempre registradas no ledger)
  transaction_fee_structure: {
    base_rate: number; // Taxa base (%)
    regional_fund_percentage: number; // % da taxa que vai para Fundo Regional
    platform_percentage: number; // % da taxa que vai para Plataforma
    referral_percentage?: number; // % da taxa que vai para Indicação/Grupo
  };
  // Limites
  monthly_transaction_limit?: number; // Limite mensal (se aplicável)
  // Timestamps
  requested_at: string;
  approved_at?: string;
  activated_at?: string;
  created_at: string;
  updated_at: string;
}





