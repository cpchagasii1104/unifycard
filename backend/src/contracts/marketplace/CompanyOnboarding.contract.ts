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
  onboarding_id: string;
  company_id: string; // ID da empresa criada
  company_type: 'cnpj' | 'cpf' | 'mei';
  company_name: string;
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
    cnpj?: string; // CNPJ (obrigatório se company_type = 'cnpj')
    qsa_document?: string; // Quadro Societário Atualizado
    last_contractual_change?: string; // Última alteração contratual (ISO 8601)
    address_proof?: string; // Comprovante de endereço (URL ou hash)
  };
  // OBRIGATÓRIO: Conta bancária
  bank_account: {
    type: 'unifibank' | 'external';
    account_id?: string; // ID da conta no UnifiBank (se type = 'unifibank')
    external_bank_name?: string; // Nome do banco externo
    external_account_number?: string; // Número da conta externa
    verified: boolean; // Verificação da conta
  };
  // Configurações de integração
  marketplace_enabled: boolean; // Opt-in para aparecer no Marketplace
  services_enabled: boolean; // Criar perfil de serviços
  products_enabled: boolean; // Criar perfil de produtos
  pdv_enabled: boolean; // Habilitar ERP Light + PDV
  // Payment Infrastructure (obrigatório)
  payment_infrastructure: {
    accept_unificard: boolean; // Default recomendado
    accept_external_gateway: boolean; // Cielo, Stone, etc.
    external_gateway_provider?: string; // Nome do gateway externo
  };
  // Plan
  plan_id: string; // Referência ao CompanyPlan
  // Business Template (opcional - para importação de catálogo canônico)
  business_template_id?: string; // Referência ao BusinessTemplate
  // Status
  status: 'draft' | 'in_progress' | 'completed' | 'failed';
  // Integrações criadas
  economic_identity_id?: string;
  store_id?: string;
  branch_id?: string;
  service_provider_id?: string;
  industry_account_id?: string;
  hub_id?: string;
  payment_infrastructure_config_id?: string;
  // Timestamps
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

