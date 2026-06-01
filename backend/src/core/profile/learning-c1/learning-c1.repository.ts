// backend/src/core/profile/learning-c1/learning-c1.repository.ts
//
// C1 — acesso a actor_learning_concepts. COLUNAS EXPLÍCITAS; SEM SELECT *; tenant_id=$1 em toda query.
// actorId = valor recebido (actionContext.actorId). NENHUMA criação de actor. Sem global_users.metadata.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  LearningConceptRow,
  ActorIdentityCheckRow,
  CategorySemanticsRow,
  DeclareLearningConceptInput,
  UpdateLearningConceptInput,
} from './learning-c1.types';

const CONCEPT_COLS =
  'id, tenant_id, actor_id, concept_id, source_category_id, progress, ' +
  'is_active, declared_at, updated_at, retired_at';

class LearningC1Repository {
  async getActorIdentityCheck(
    tenantId: string,
    actorId: string
  ): Promise<ActorIdentityCheckRow | undefined> {
    return runQueryWithTenant<ActorIdentityCheckRow>(
      tenantId,
      `SELECT id, actor_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
      [tenantId, actorId]
    );
  }

  // Breadcrumb-consistência: scope + concept_id da categoria (categories é global; sem tenant_id).
  async getCategorySemantics(
    tenantId: string,
    categoryId: string
  ): Promise<CategorySemanticsRow | undefined> {
    return runQueryWithTenant<CategorySemanticsRow>(
      tenantId,
      `SELECT scope, concept_id FROM categories WHERE category_id = $1 LIMIT 1`,
      [categoryId]
    );
  }

  async listActiveConcepts(
    tenantId: string,
    actorId: string
  ): Promise<LearningConceptRow[]> {
    return runQueriesWithTenant<LearningConceptRow>(
      tenantId,
      `SELECT ${CONCEPT_COLS}
         FROM actor_learning_concepts
        WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
        ORDER BY declared_at`,
      [tenantId, actorId]
    );
  }

  // Linha do concept para o actor, ATIVA OU INATIVA (para decidir 409 vs reativação). LIMIT 1 (UNIQUE).
  async findByConcept(
    tenantId: string,
    actorId: string,
    conceptId: string
  ): Promise<LearningConceptRow | undefined> {
    return runQueryWithTenant<LearningConceptRow>(
      tenantId,
      `SELECT ${CONCEPT_COLS}
         FROM actor_learning_concepts
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3
        LIMIT 1`,
      [tenantId, actorId, conceptId]
    );
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareLearningConceptInput
  ): Promise<LearningConceptRow> {
    const row = await runQueryWithTenant<LearningConceptRow>(
      tenantId,
      `INSERT INTO actor_learning_concepts
         (tenant_id, actor_id, concept_id, source_category_id, progress)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CONCEPT_COLS}`,
      [
        tenantId,
        actorId,
        input.conceptId,
        input.sourceCategoryId ?? null,
        input.progress ?? null,
      ]
    );
    if (!row) throw new Error('declareConcept: RETURNING vazio inesperado');
    return row;
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateLearningConceptInput
  ): Promise<LearningConceptRow | undefined> {
    const sets: string[] = [];
    const values: unknown[] = [tenantId, actorId, conceptId];
    let i = 4;

    if (patch.progress !== undefined) {
      sets.push(`progress = $${i++}`);
      values.push(patch.progress);
    }
    if (patch.sourceCategoryId !== undefined) {
      sets.push(`source_category_id = $${i++}`);
      values.push(patch.sourceCategoryId);
    }
    if (patch.reactivate === true) {
      // ciclo binário: ativa ⇒ retired_at NULL (honra chk_actor_learning_concepts_lifecycle)
      sets.push(`is_active = true`);
      sets.push(`retired_at = NULL`);
    }

    sets.push(`updated_at = now()`);

    return runQueryWithTenant<LearningConceptRow>(
      tenantId,
      `UPDATE actor_learning_concepts
          SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3
        RETURNING ${CONCEPT_COLS}`,
      values
    );
  }

  // Remoção = desativação lógica (NUNCA delete físico). Só retira se estiver ativa.
  async retireConcept(
    tenantId: string,
    actorId: string,
    conceptId: string
  ): Promise<LearningConceptRow | undefined> {
    return runQueryWithTenant<LearningConceptRow>(
      tenantId,
      `UPDATE actor_learning_concepts
          SET is_active = false, retired_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true
        RETURNING ${CONCEPT_COLS}`,
      [tenantId, actorId, conceptId]
    );
  }
}

export const learningC1Repository = new LearningC1Repository();
