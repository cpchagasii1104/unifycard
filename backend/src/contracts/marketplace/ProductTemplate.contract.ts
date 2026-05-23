// backend/src/contracts/marketplace/ProductTemplate.contract.ts
// Contrato mínimo de ProductTemplate (catálogo canônico / templates em memória).

export type ProductTemplateType = 'industrialized' | 'own' | 'both';

export interface ProductTemplate {
  templateId: string;
  name: string;
  description: string;
  categoryId: string;
  type: ProductTemplateType;
  defaultUnit: string;
  canonicalImages: {
    main: string;
    thumbnail?: string;
  };
  attributes: Record<string, string>;
  version: string;
  createdAt: string;
  immutable: true;
}
