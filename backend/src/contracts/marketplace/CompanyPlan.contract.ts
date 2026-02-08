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
  planId: string;
  name: string; // 'basic' | 'professional' | 'industrial' | 'hub'
  displayName: string; // Nome para exibição
  description: string;
  // Capacidades desbloqueadas
  capabilities: {
    maxStores?: number; // Número máximo de lojas
    maxBranches?: number; // Número máximo de filiais
    maxProducts?: number; // Número máximo de produtos
    maxServices?: number; // Número máximo de serviços
    maxMonthlyTransactions?: number; // Limite mensal de transações
    b2bContractsEnabled: boolean; // Permite contratos B2B
    industryEnabled: boolean; // Permite criar produtos industriais
    hubEnabled: boolean; // Permite criar hubs
    batchProductionEnabled: boolean; // Permite criar lotes de produção
    pdvEnabled: boolean; // Permite usar PDV
    advancedAnalytics: boolean; // Analytics avançados
  };
  // Preço (se aplicável)
  price?: {
    amountCents: number;
    currency: string;
    billingCycle: 'monthly' | 'yearly';
  };
  // Status
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}






