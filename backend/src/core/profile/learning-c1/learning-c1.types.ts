// backend/src/core/profile/learning-c1/learning-c1.types.ts
//
// C1 — Substrato declarativo de APRENDIZADO actor-first (DECISION-0067).
// Espelha professional-c1.types, mas: atributo `progress` (1..3 = exploração, NÃO competência;
// sem skill_level/years_experience), e SEM bio/profile.

// ── Linha interna (espelha colunas vivas de actor_learning_concepts) ──────────
export interface LearningConceptRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  concept_id: string;
  source_category_id: string | null;
  progress: number | null;
  is_active: boolean;
  declared_at: Date;
  updated_at: Date;
  retired_at: Date | null;
}

// Read dedicado do invariante (id E actor_id).
export interface ActorIdentityCheckRow {
  id: string;
  actor_id: string;
}

// Breadcrumb-consistência (read-only): scope + concept da categoria.
export interface CategorySemanticsRow {
  scope: string | null;
  concept_id: string | null;
}

// ── DTO de saída (camelCase) ──────────────────────────────────────────────────
export interface LearningConceptDTO {
  conceptId: string;
  sourceCategoryId: string | null;
  progress: number | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface LearningC1DTO {
  concepts: LearningConceptDTO[];
}

// ── Inputs (camelCase) ─────────────────────────────────────────────────────────
export interface DeclareLearningConceptInput {
  conceptId: string;
  sourceCategoryId?: string | null;
  progress?: number | null;
}

export interface UpdateLearningConceptInput {
  progress?: number | null;
  sourceCategoryId?: string | null;
  reactivate?: boolean;
}
