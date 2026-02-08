// backend/src/contracts/marketplace/CompanyOnboarding.contract.ts
// CONTRATO PÚBLICO CONGELADO - CompanyOnboarding (Onboarding Unificado de Empresas)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * CompanyOnboarding - Onboarding Unificado de Empresas
 * 
 * Fluxo de criação de empresa totalmente integrado ao Marketplace,
 * Trust Layer, Pagamentos, Fundo Regional e Serviços.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface CompanyOnboarding {
  onboardingId: string;
  companyId: string; // ID da empresa criada
  companyType: 'cnpj' | 'cpf' | 'mei';
  companyName: string;
  document: string; // CNPJ, CPF ou MEI
  // OBRIGATÓRIO: Categoria principal
  category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  // OBRIGATÓRIO: Documentos
  documents: {
    cnpj?: string; // CNPJ (obrigatório se companyType = 'cnpj')
    qsaDocument?: string; // Quadro Societário Atualizado
    lastContractualChange?: string; // Última alteração contratual (ISO 8601)
    addressProof?: string; // Comprovante de endereço (URL ou hash)
  };
  // OBRIGATÓRIO: Conta bancária
  bankAccount: {
    type: 'unifibank' | 'external';
    accountId?: string; // ID da conta no UnifiBank (se type = 'unifibank')
    externalBankName?: string; // Nome do banco externo
    externalAccountNumber?: string; // Número da conta externa
    isVerified: boolean; // Verificação da conta
  };
  // Configurações de integração
  marketplaceEnabled: boolean; // Opt-in para aparecer no Marketplace
  servicesEnabled: boolean; // Criar perfil de serviços
  productsEnabled: boolean; // Criar perfil de produtos
  pdvEnabled: boolean; // Habilitar ERP Light + PDV
  // Payment Infrastructure (obrigatório)
  paymentInfrastructure: {
    acceptUnificard: boolean; // Default recomendado
    acceptExternalGateway: boolean; // Cielo, Stone, etc.
    externalGatewayProvider?: string; // Nome do gateway externo
  };
  // Plan
  planId: string; // Referência ao CompanyPlan
  // Business Template (opcional - para importação de catálogo canônico)
  businessTemplateId?: string; // Referência ao BusinessTemplate
  // Status
  status: 'draft' | 'in_progress' | 'completed' | 'failed';
  // Integrações criadas
  economicIdentityId?: string;
  storeId?: string;
  branchId?: string;
  serviceProviderId?: string;
  industryAccountId?: string;
  hubId?: string;
  paymentInfrastructureConfigId?: string;
  // Timestamps
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
}

