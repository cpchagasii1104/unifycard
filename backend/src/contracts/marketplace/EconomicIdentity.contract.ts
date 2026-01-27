// backend/src/contracts/marketplace/EconomicIdentity.contract.ts
// CONTRATO PÚBLICO CONGELADO - EconomicIdentity (Identidade Econômica)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * EconomicIdentity - Identidade Econômica de um ator
 * 
 * Trust Level é derivado de fatos objetivos, nunca manual.
 * Sem IA, sem score oculto, sem override manual.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface EconomicIdentity {
  economic_identity_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  actor_id: string;
  trust_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  verified_assets: {
    documents_verified: boolean; // CPF/CNPJ verificado
    bank_account_verified: boolean; // Conta bancária verificada
    company_verified: boolean; // Empresa verificada (se aplicável)
  };
  limits: {
    max_invoice_amount: number; // Valor máximo para faturamento B2B
    max_monthly_volume: number; // Volume mensal máximo permitido
  };
  status: 'active' | 'restricted' | 'suspended';
  created_at: string;
  updated_at: string;
}





