// backend/src/core/profile/professional-c1/professional-c1.types.ts
//
// C1 — Substrato profissional declarativo actor-first (DECISION-0063 / DESENHO_A2).
// DTOs do contrato limpo + tipos internos de linha. SEM conceptId_semantic (REPARO 4).
// Nome/label de concept = enriquecimento futuro (A3/UI), NÃO em A2.

// ── Linhas internas (espelham as colunas vivas das 2 tabelas C1) ──────────────
export interface ProfileRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  professional_bio: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConceptRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  concept_id: string;
  source_category_id: string | null;
  skill_level: number;
  years_experience: number | null;
  is_active: boolean;
  declared_at: Date;
  updated_at: Date;
  retired_at: Date | null;
}

// REPARO 2 — read dedicado do invariante (id E actor_id); read-only.
export interface ActorIdentityCheckRow {
  id: string;
  actor_id: string;
}

// ── DTOs de saída (camelCase; DTO seco) ───────────────────────────────────────
export interface ConceptDTO {
  conceptId: string;
  sourceCategoryId: string | null;
  skillLevel: number;
  yearsExperience: number | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

// Shape D-A1.2 verbatim: chave de bio em snake_case.
export interface ProfessionalC1DTO {
  concepts: ConceptDTO[];
  professional_bio: string | null;
}

export interface BioDTO {
  professional_bio: string | null;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
export interface DeclareConceptInput {
  conceptId: string;
  sourceCategoryId?: string | null;
  skillLevel: number;
  yearsExperience?: number | null;
}

export interface UpdateConceptInput {
  skillLevel?: number;
  yearsExperience?: number | null;
  reactivate?: boolean;
}
