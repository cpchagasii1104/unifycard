// backend/src/core/profile/interest-c1/interest-c1.service.ts
//
// C1 — regras do substrato de interesse declarativo (binário). SEM SQL cru (delega ao repository).
// Guarda de identidade + invariante; breadcrumb-consistência quando há source_category_id.
// PROIBIÇÕES: zero lifestyle/inferred/professional/capability/authority/bank_*; zero ensureUserActor;
//   zero global_users.metadata; zero console.log.

import { HttpError } from '@core/errors/http-error';
import { interestC1Repository } from './interest-c1.repository';
import type {
  InterestConceptRow,
  InterestConceptDTO,
  InterestC1DTO,
  DeclareInterestConceptInput,
  UpdateInterestConceptInput,
} from './interest-c1.types';

const INTEREST_SCOPE = 'interest' as const;

function mapIntegrityError(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code === '23505') {
    throw HttpError.conflict('Interesse já declarado para este concept');
  }
  if (code === '23503') {
    throw HttpError.badRequest('concept_id ou source_category_id inválido (referência inexistente)');
  }
  throw err as Error;
}

function toDTO(row: InterestConceptRow): InterestConceptDTO {
  return {
    conceptId: row.concept_id,
    sourceCategoryId: row.source_category_id,
    isActive: row.is_active,
    declaredAt: row.declared_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  };
}

class InterestC1Service {
  private async resolveActorGuarded(tenantId: string, actorId: string): Promise<void> {
    const identity = await interestC1Repository.getActorIdentityCheck(tenantId, actorId);
    if (!identity) {
      throw HttpError.notFound('Actor não encontrado');
    }
    if (identity.id !== identity.actor_id) {
      throw new HttpError('ACTOR_ID_INVARIANT_BROKEN', 500);
    }
  }

  private async assertSourceCategory(
    tenantId: string,
    sourceCategoryId: string,
    conceptId: string
  ): Promise<void> {
    const cat = await interestC1Repository.getCategorySemantics(tenantId, sourceCategoryId);
    if (!cat) {
      throw HttpError.badRequest('source_category_id inexistente');
    }
    if (cat.scope !== INTEREST_SCOPE) {
      throw HttpError.badRequest(`source_category_id fora do escopo '${INTEREST_SCOPE}'`);
    }
    if (!cat.concept_id) {
      throw HttpError.badRequest('source_category_id sem concept_id (breadcrumb inválido)');
    }
    if (cat.concept_id !== conceptId) {
      throw HttpError.badRequest('source_category_id não corresponde ao conceptId declarado');
    }
  }

  async getInterestC1(tenantId: string, actorId: string): Promise<InterestC1DTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    const concepts = await interestC1Repository.listActiveConcepts(tenantId, actorId);
    return { concepts: concepts.map(toDTO) };
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareInterestConceptInput
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    if (!input.conceptId) throw HttpError.badRequest('conceptId é obrigatório');
    if (input.sourceCategoryId) {
      await this.assertSourceCategory(tenantId, input.sourceCategoryId, input.conceptId);
    }
    try {
      const row = await interestC1Repository.declareConcept(tenantId, actorId, input);
      return toDTO(row);
    } catch (err) {
      mapIntegrityError(err);
    }
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateInterestConceptInput
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    if (patch.sourceCategoryId) {
      await this.assertSourceCategory(tenantId, patch.sourceCategoryId, conceptId);
    }
    try {
      const row = await interestC1Repository.updateConcept(tenantId, actorId, conceptId, patch);
      if (!row) throw HttpError.notFound('Interesse não encontrado');
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
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    const row = await interestC1Repository.retireConcept(tenantId, actorId, conceptId);
    if (!row) throw HttpError.notFound('Interesse ativo não encontrado');
    return toDTO(row);
  }
}

export const interestC1Service = new InterestC1Service();
