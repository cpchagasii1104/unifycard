// backend/src/contracts/marketplace/IndustryAccount.contract.ts
// CONTRATO PÚBLICO CONGELADO - IndustryAccount (Conta de Indústria)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * IndustryAccount - Conta de Indústria no Marketplace
 * 
 * Indústria não vende direto ao consumidor, apenas:
 * - publica produtos canônicos
 * - define política de margem base
 * - define hubs autorizados
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface IndustryAccount {
  industry_id: string;
  name: string;
  cnpj: string;
  categories_supported: string[]; // IDs de categorias que a indústria suporta
  default_margin_rules: {
    hub_margin_percentage: number; // Margem sugerida para hubs (ex: 15%)
    store_margin_percentage: number; // Margem sugerida para lojas (ex: 25%)
    minimum_price?: number; // Preço mínimo sugerido
  };
  authorized_hubs: string[]; // IDs de hubs autorizados
  active: boolean;
  created_at: string;
  updated_at: string;
}





