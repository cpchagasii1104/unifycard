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
  // 🔴 DECISION-0113 fatia 5.2: representabilidade (canRepresentActor) ANTES da existência — o `userId`
  // autenticado precisa poder representar o `actorId` declarado (actor-keyed: self/empresa/grupo/delegação).
  // Uniforme (false p/ inexistente E alheio) → 403 sem vazar existência de actor de terceiro.
  private async resolveActorGuarded(tenantId: string, actorId: string, userId: string): Promise<void> {
    let representable = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      representable = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      representable = false;
    }
    if (!representable) {
      throw new HttpError('Actor não representável pelo usuário autenticado', 403);
    }
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

  async getInterestC1(tenantId: string, actorId: string, userId: string): Promise<InterestC1DTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    const concepts = await interestC1Repository.listActiveConcepts(tenantId, actorId);
    return { concepts: concepts.map(toDTO) };
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareInterestConceptInput,
    userId: string
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    if (!input.conceptId) throw HttpError.badRequest('conceptId é obrigatório');
    if (input.sourceCategoryId) {
      await this.assertSourceCategory(tenantId, input.sourceCategoryId, input.conceptId);
    }

    // Idempotência por declaração (DT-C1-LEARNING-INTEREST-REACTIVATION): o POST não deve falhar com 409
    // quando o mesmo concept já existe INATIVO (soft-delete) — deve REATIVAR a linha existente (sem
    // duplicar; UNIQUE tenant+actor+concept). Concept ATIVO → 409 preservado. Inexistente → INSERT.
    // Interest é binário (sem progress); breadcrumb só muda se enviado; declared_at preservado.
    const existing = await interestC1Repository.findByConcept(tenantId, actorId, input.conceptId);
    if (existing) {
      if (existing.is_active) {
        throw HttpError.conflict('Interesse já declarado para este concept');
      }
      const row = await interestC1Repository.updateConcept(tenantId, actorId, input.conceptId, {
        reactivate: true,
        sourceCategoryId: input.sourceCategoryId, // undefined ⇒ preserva breadcrumb; valor ⇒ atualiza
      });
      if (!row) throw HttpError.notFound('Interesse não encontrado');
      return toDTO(row);
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
    patch: UpdateInterestConceptInput,
    userId: string
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
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
    conceptId: string,
    userId: string
  ): Promise<InterestConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    const row = await interestC1Repository.retireConcept(tenantId, actorId, conceptId);
    if (!row) throw HttpError.notFound('Interesse ativo não encontrado');
    return toDTO(row);
  }
}

export const interestC1Service = new InterestC1Service();
