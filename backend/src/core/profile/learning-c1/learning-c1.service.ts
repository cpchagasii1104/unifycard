// backend/src/core/profile/learning-c1/learning-c1.service.ts
//
// C1 — regras do substrato de aprendizado declarativo. SEM SQL cru (delega ao repository).
// Toda operação: (a) guarda de identidade + invariante; (b) breadcrumb-consistência quando há
// source_category_id. PROIBIÇÕES: zero professional/skill_level/capability/authority/oferta/agenda/
//   bank_*; zero ensureUserActor; zero lookup solto; zero global_users.metadata; zero console.log.

import { HttpError } from '@core/errors/http-error';
import { learningC1Repository } from './learning-c1.repository';
import type {
  LearningConceptRow,
  LearningConceptDTO,
  LearningC1DTO,
  DeclareLearningConceptInput,
  UpdateLearningConceptInput,
} from './learning-c1.types';

const LEARNING_SCOPE = 'learning' as const;

function mapIntegrityError(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code === '23505') {
    throw HttpError.conflict('Aprendizado já declarado para este concept');
  }
  if (code === '23503') {
    throw HttpError.badRequest('concept_id ou source_category_id inválido (referência inexistente)');
  }
  if (code === '23514') {
    throw HttpError.badRequest('Valor fora do permitido (progress 1..3)');
  }
  throw err as Error;
}

function toDTO(row: LearningConceptRow): LearningConceptDTO {
  return {
    conceptId: row.concept_id,
    sourceCategoryId: row.source_category_id,
    progress: row.progress,
    isActive: row.is_active,
    declaredAt: row.declared_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  };
}

function assertProgress(v: number | null | undefined): void {
  if (v === null || v === undefined) return;
  if (!Number.isInteger(v) || v < 1 || v > 3) {
    throw HttpError.badRequest('progress deve ser inteiro entre 1 e 3, ou nulo');
  }
}

class LearningC1Service {
  private async resolveActorGuarded(tenantId: string, actorId: string): Promise<void> {
    const identity = await learningC1Repository.getActorIdentityCheck(tenantId, actorId);
    if (!identity) {
      throw HttpError.notFound('Actor não encontrado');
    }
    if (identity.id !== identity.actor_id) {
      throw new HttpError('ACTOR_ID_INVARIANT_BROKEN', 500);
    }
  }

  // Breadcrumb-consistência (DECISION-0067 / regra Fatia 2): se há source_category_id, a categoria
  // deve existir, estar em scope='learning', ter concept_id, e bater com o conceptId declarado.
  private async assertSourceCategory(
    tenantId: string,
    sourceCategoryId: string,
    conceptId: string
  ): Promise<void> {
    const cat = await learningC1Repository.getCategorySemantics(tenantId, sourceCategoryId);
    if (!cat) {
      throw HttpError.badRequest('source_category_id inexistente');
    }
    if (cat.scope !== LEARNING_SCOPE) {
      throw HttpError.badRequest(`source_category_id fora do escopo '${LEARNING_SCOPE}'`);
    }
    if (!cat.concept_id) {
      throw HttpError.badRequest('source_category_id sem concept_id (breadcrumb inválido)');
    }
    if (cat.concept_id !== conceptId) {
      throw HttpError.badRequest('source_category_id não corresponde ao conceptId declarado');
    }
  }

  async getLearningC1(tenantId: string, actorId: string): Promise<LearningC1DTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    const concepts = await learningC1Repository.listActiveConcepts(tenantId, actorId);
    return { concepts: concepts.map(toDTO) };
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareLearningConceptInput
  ): Promise<LearningConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    if (!input.conceptId) throw HttpError.badRequest('conceptId é obrigatório');
    assertProgress(input.progress);
    if (input.sourceCategoryId) {
      await this.assertSourceCategory(tenantId, input.sourceCategoryId, input.conceptId);
    }
    try {
      const row = await learningC1Repository.declareConcept(tenantId, actorId, input);
      return toDTO(row);
    } catch (err) {
      mapIntegrityError(err);
    }
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateLearningConceptInput
  ): Promise<LearningConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    if (patch.progress !== undefined) assertProgress(patch.progress);
    if (patch.sourceCategoryId) {
      await this.assertSourceCategory(tenantId, patch.sourceCategoryId, conceptId);
    }
    try {
      const row = await learningC1Repository.updateConcept(tenantId, actorId, conceptId, patch);
      if (!row) throw HttpError.notFound('Aprendizado não encontrado');
      return toDTO(row);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      mapIntegrityError(err);
    }
  }

  async retireConcept(
    tenantId: string,
    actorId: string,
    conceptId: string
  ): Promise<LearningConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    const row = await learningC1Repository.retireConcept(tenantId, actorId, conceptId);
    if (!row) throw HttpError.notFound('Aprendizado ativo não encontrado');
    return toDTO(row);
  }
}

export const learningC1Service = new LearningC1Service();
