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
  configId: string;
  companyId: string;
  // Configurações de aceitação
  acceptUnificard: boolean;
  acceptExternalGateway: boolean;
  externalGatewayProvider?: string; // Cielo, Stone, etc.
  // Estrutura de taxas (determinística)
  feeStructure: {
    transactionRate: number; // % sobre transação
    regionalFundPercentage: number; // % da taxa que vai para Fundo Regional
    platformPercentage: number; // % da taxa que vai para Plataforma
    infrastructurePercentage: number; // % da taxa que cobre infraestrutura (debitado do Fundo Regional)
    referralPercentage?: number; // % da taxa que vai para Indicação/Grupo
  };
  // Status
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  updatedAt: string;
}





