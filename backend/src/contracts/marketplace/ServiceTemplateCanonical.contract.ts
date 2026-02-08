// backend/src/contracts/marketplace/ServiceTemplateCanonical.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceTemplateCanonical (Template de Serviço Canônico)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceTemplateCanonical - Template de Serviço Canônico
 * 
 * Templates de serviços mantidos na "matriz" do sistema (imutáveis, versionados).
 * Permitem importação rápida de catálogo-base durante onboarding.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceTemplateCanonical {
  templateId: string;
  name: string;
  description?: string;
  categoryId: string;
  type: 'one_time' | 'recurring' | 'quote_required';
  defaultDurationMinutes?: number;
  defaultPricingModel: 'fixed' | 'hourly' | 'per_unit';
  canonicalImages: {
    icon?: string;
    banner?: string;
  };
  attributes: Record<string, any>; // Requisitos, materiais, etc.
  version: string; // v1, v2, etc.
  createdAt: string;
  updatedAt?: string; // Apenas para novos imports, nunca altera template existente
  // Imutável após criação
  immutable: true;
}





