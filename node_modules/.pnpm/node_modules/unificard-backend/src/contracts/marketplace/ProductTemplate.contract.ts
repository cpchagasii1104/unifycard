// backend/src/contracts/marketplace/ProductTemplate.contract.ts
// CONTRATO PÚBLICO CONGELADO - ProductTemplate (Template de Produto Canônico)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ProductTemplate - Template de Produto Canônico
 * 
 * Templates de produtos mantidos na "matriz" do sistema (imutáveis, versionados).
 * Permitem importação rápida de catálogo-base durante onboarding.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export type ProductTemplateType = 'industrialized' | 'own' | 'service';

export interface ProductTemplate {
  templateId: string;
  name: string;
  description?: string;
  categoryId: string;
  type: ProductTemplateType;
  defaultUnit: string; // kg, un, l, m, etc.
  canonicalImages: {
    main?: string;
    thumbnail?: string;
  };
  attributes: Record<string, any>; // volume, embalagem, duração, etc.
  version: string; // v1, v2, etc.
  createdAt: string;
  updatedAt?: string; // Apenas para novos imports, nunca altera template existente
  // Imutável após criação
  immutable: true;
}





