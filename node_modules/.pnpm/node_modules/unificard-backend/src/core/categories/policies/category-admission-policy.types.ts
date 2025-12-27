// src/core/categories/policies/category-admission-policy.types.ts
// Tipos para política de admissão semântica de categorias

export type CategoryDomainType = 
  | 'PROFESSION' 
  | 'HOBBY' 
  | 'SPORT' 
  | 'CRIME' 
  | 'SEXUAL' 
  | 'VIOLENCE' 
  | 'HATE' 
  | 'UNKNOWN';

export type AdmissionDecisionType = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface AdmissionDecision {
  decision: AdmissionDecisionType;
  reason: string;
  confidence: number;
  flags: string[];
  domainType?: CategoryDomainType;
  aiContext?: {
    reasoning: string;
    classification: string;
  };
}

export interface AIContext {
  suggestedRoot?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  suggestedParent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  leafName: string;
  confidence: number;
  reasoning?: string;
}















