// backend/src/core/profile/interest-c1/interest-c1.repository.ts
//
// C1 — acesso a actor_interest_concepts. COLUNAS EXPLÍCITAS; SEM SELECT *; tenant_id=$1 em toda query.
// actorId = valor recebido (actionContext.actorId). Sem criação de actor. Sem global_users.metadata.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  InterestConceptRow,
  ActorIdentityCheckRow,
  CategorySemanticsRow,
  DeclareInterestConceptInput,
  UpdateInterestConceptInput,
} from './interest-c1.types';

const CONCEPT_COLS =
  'id, tenant_id, actor_id, concept_id, source_category_id, ' +
  'is_active, declared_at, updated_at, retired_at';

class InterestC1Repository {
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
  ): Promise<InterestConceptRow[]> {
    return runQueriesWithTenant<InterestConceptRow>(
      tenantId,
      `SELECT ${CONCEPT_COLS}
         FROM actor_interest_concepts
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
  ): Promise<InterestConceptRow | undefined> {
    return runQueryWithTenant<InterestConceptRow>(
      tenantId,
      `SELECT ${CONCEPT_COLS}
         FROM actor_interest_concepts
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3
        LIMIT 1`,
      [tenantId, actorId, conceptId]
    );
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareInterestConceptInput
  ): Promise<InterestConceptRow> {
    const row = await runQueryWithTenant<InterestConceptRow>(
      tenantId,
      `INSERT INTO actor_interest_concepts
         (tenant_id, actor_id, concept_id, source_category_id)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CONCEPT_COLS}`,
      [tenantId, actorId, input.conceptId, input.sourceCategoryId ?? null]
    );
    if (!row) throw new Error('declareConcept: RETURNING vazio inesperado');
    return row;
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateInterestConceptInput
  ): Promise<InterestConceptRow | undefined> {
    const sets: string[] = [];
    const values: unknown[] = [tenantId, actorId, conceptId];
    let i = 4;

    if (patch.sourceCategoryId !== undefined) {
      sets.push(`source_category_id = $${i++}`);
      values.push(patch.sourceCategoryId);
    }
    if (patch.reactivate === true) {
      sets.push(`is_active = true`);
      sets.push(`retired_at = NULL`);
    }

    sets.push(`updated_at = now()`);

    return runQueryWithTenant<InterestConceptRow>(
      tenantId,
      `UPDATE actor_interest_concepts
          SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3
        RETURNING ${CONCEPT_COLS}`,
      values
    );
  }

  async retireConcept(
    tenantId: string,
    actorId: string,
    conceptId: string
  ): Promise<InterestConceptRow | undefined> {
    return runQueryWithTenant<InterestConceptRow>(
      tenantId,
      `UPDATE actor_interest_concepts
          SET is_active = false, retired_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true
        RETURNING ${CONCEPT_COLS}`,
      [tenantId, actorId, conceptId]
    );
  }
}

export const interestC1Repository = new InterestC1Repository();
