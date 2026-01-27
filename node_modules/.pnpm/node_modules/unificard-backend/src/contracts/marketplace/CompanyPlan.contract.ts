// backend/src/contracts/marketplace/CompanyPlan.contract.ts
// CONTRATO PÚBLICO CONGELADO - CompanyPlan (Plano de Empresa)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * CompanyPlan - Plano de Empresa
 * 
 * Estrutura de planos que desbloqueiam capacidades.
 * NÃO é sistema de anúncios pagos.
 * Monetização via transações, serviços, contratos B2B, indústria/lotes/hubs.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface CompanyPlan {
  plan_id: string;
  name: string; // 'basic' | 'professional' | 'industrial' | 'hub'
  display_name: string; // Nome para exibição
  description: string;
  // Capacidades desbloqueadas
  capabilities: {
    max_stores?: number; // Número máximo de lojas
    max_branches?: number; // Número máximo de filiais
    max_products?: number; // Número máximo de produtos
    max_services?: number; // Número máximo de serviços
    max_monthly_transactions?: number; // Limite mensal de transações
    b2b_contracts_enabled: boolean; // Permite contratos B2B
    industry_enabled: boolean; // Permite criar produtos industriais
    hub_enabled: boolean; // Permite criar hubs
    batch_production_enabled: boolean; // Permite criar lotes de produção
    pdv_enabled: boolean; // Permite usar PDV
    advanced_analytics: boolean; // Analytics avançados
  };
  // Preço (se aplicável)
  price?: {
    amount: number;
    currency: string;
    billing_cycle: 'monthly' | 'yearly';
  };
  // Status
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}





