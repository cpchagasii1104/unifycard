// backend/src/contracts/marketplace/PaymentInfrastructureConfig.contract.ts
// CONTRATO PÚBLICO CONGELADO - PaymentInfrastructureConfig (Configuração de Infraestrutura de Pagamento)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * PaymentInfrastructureConfig - Configuração de Infraestrutura de Pagamento
 * 
 * Configuração de pagamento por empresa.
 * Toda taxa de pagamento passa pelo ledger.
 * Taxa administrativa do sistema é debitada do Fundo Regional.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface PaymentInfrastructureConfig {
  config_id: string;
  company_id: string;
  // Configurações de aceitação
  accept_unificard: boolean;
  accept_external_gateway: boolean;
  external_gateway_provider?: string; // Cielo, Stone, etc.
  // Estrutura de taxas (determinística)
  fee_structure: {
    transaction_rate: number; // % sobre transação
    regional_fund_percentage: number; // % da taxa que vai para Fundo Regional
    platform_percentage: number; // % da taxa que vai para Plataforma
    infrastructure_percentage: number; // % da taxa que cobre infraestrutura (debitado do Fundo Regional)
    referral_percentage?: number; // % da taxa que vai para Indicação/Grupo
  };
  // Status
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
}





