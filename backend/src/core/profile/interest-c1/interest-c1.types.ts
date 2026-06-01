// backend/src/core/profile/interest-c1/interest-c1.types.ts
//
// C1 — Substrato declarativo de INTERESSE actor-first (DECISION-0067).
// Binário: sem atributo (sem weight/priority/progress). SEM bio/profile. Declarado != inferido.

export interface InterestConceptRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  concept_id: string;
  source_category_id: string | null;
  is_active: boolean;
  declared_at: Date;
  updated_at: Date;
  retired_at: Date | null;
}

export interface ActorIdentityCheckRow {
  id: string;
  actor_id: string;
}

export interface CategorySemanticsRow {
  scope: string | null;
  concept_id: string | null;
}

export interface InterestConceptDTO {
  conceptId: string;
  sourceCategoryId: string | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface InterestC1DTO {
  concepts: InterestConceptDTO[];
}

export interface DeclareInterestConceptInput {
  conceptId: string;
  sourceCategoryId?: string | null;
}

export interface UpdateInterestConceptInput {
  sourceCategoryId?: string | null;
  reactivate?: boolean;
}
