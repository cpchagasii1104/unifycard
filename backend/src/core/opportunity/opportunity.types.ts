// src/core/opportunity/opportunity.types.ts
// Tipos para Oportunidades Suaves

export type OpportunityType = 
  | 'exploratory'    // Oportunidade exploratória (projetos pequenos, colaborações)
  | 'community'      // Oportunidade comunitária (grupos, coletivos, comunidades)
  | 'professional';  // Oportunidade profissional suave (parcerias, projetos pagos)

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  category?: {
    id: string;
    name: string;
  };
  metadata?: {
    isPaid?: boolean;
    isRemote?: boolean;
    estimatedTime?: string;
    tags?: string[];
  };
  priority: number; // 1-10, maior = mais relevante
  createdAt: string;
}

export interface OpportunityResult {
  opportunities: Opportunity[];
  hasMore: boolean;
}













