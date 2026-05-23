// backend/src/contracts/marketplace/BusinessTemplate.contract.ts
// CONTRATO PÚBLICO CONGELADO - BusinessTemplate (Arquétipo de Empresa)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v2.1 — removido campo legado de templates de produto (catálogo global / StoreOnboarding)
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
  templateId: string;
  name: string;
  description: string;
  type: BusinessTemplateType;
  version: string; // v1, v2, etc.
  categoryIds: string[]; // Categorias de produtos/serviços padrão (legado / UI; industrial vem do catálogo global)
  allowedProductTypes: ProductType; // industrialized, own, both
  /** IDs de ProductTemplate canônicos (opcional — legado / importação de loja). */
  defaultProductTemplates?: string[];
  defaultServiceTemplates: string[]; // IDs de ServiceTemplateCanonical
  operationalConfig: {
    requiresAgenda: boolean;
    supportsDispatch: boolean;
    supportsQuoteFlow: boolean;
    supportsPdv: boolean;
    supportsB2b: boolean;
  };
  defaultRolesEnabled: Array<'manager' | 'sales' | 'service_operator' | 'accountant'>;
  recommendedPlan: CompanyPlanType;
  canonicalImages: {
    logo?: string;
    banner?: string;
    icon?: string;
  };
  flags: {
    allowsOwnProducts: boolean;
    allowsIndustrialProducts: boolean;
    allowsServices: boolean;
  };
  createdAt: string;
  updatedAt?: string; // Apenas para novos imports, nunca altera template existente
  // Imutável após criação
  immutable: true;
}
