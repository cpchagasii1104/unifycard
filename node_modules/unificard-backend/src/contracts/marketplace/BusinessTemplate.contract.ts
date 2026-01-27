// backend/src/contracts/marketplace/BusinessTemplate.contract.ts
// CONTRATO PÚBLICO CONGELADO - BusinessTemplate (Arquétipo de Empresa)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v2.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * BusinessTemplate - Arquétipo Canônico de Empresa
 * 
 * Templates canônicos que conectam:
 * categoria → catálogo → serviços → permissões → fluxo operacional
 * 
 * Permitem que uma empresa "nasça pronta" no sistema com poucos cliques.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export type BusinessTemplateType =
  | 'supermarket'
  | 'beverage_distributor'
  | 'pharmacy'
  | 'gym'
  | 'clinic'
  | 'service_provider'
  | 'restaurant'
  | 'construction_material'
  | 'beauty_services'
  | 'health_clinic';

export type ProductType = 'industrialized' | 'own' | 'both';

export type CompanyPlanType = 'Basic' | 'Professional' | 'Industrial';

export interface BusinessTemplate {
  template_id: string;
  name: string;
  description: string;
  type: BusinessTemplateType;
  version: string; // v1, v2, etc.
  category_ids: string[]; // Categorias de produtos/serviços padrão
  allowed_product_types: ProductType; // industrialized, own, both
  default_product_templates: string[]; // IDs de ProductTemplate
  default_service_templates: string[]; // IDs de ServiceTemplateCanonical
  operational_config: {
    requires_agenda: boolean;
    supports_dispatch: boolean;
    supports_quote_flow: boolean;
    supports_pdv: boolean;
    supports_b2b: boolean;
  };
  default_roles_enabled: Array<'manager' | 'sales' | 'service_operator' | 'accountant'>;
  recommended_plan: CompanyPlanType;
  canonical_images: {
    logo?: string;
    banner?: string;
    icon?: string;
  };
  flags: {
    allows_own_products: boolean;
    allows_industrial_products: boolean;
    allows_services: boolean;
  };
  created_at: string;
  updated_at?: string; // Apenas para novos imports, nunca altera template existente
  // Imutável após criação
  immutable: true;
}
