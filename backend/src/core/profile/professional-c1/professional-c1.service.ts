// backend/src/core/profile/professional-c1/professional-c1.service.ts
//
// C1 — regras do substrato profissional declarativo. SEM SQL cru (delega ao repository).
// TODA operação começa por: (a) guarda de identidade [REPARO 1]; (b) invariante [REPARO 2].
// PROIBIÇÕES (Contrato A1 cond.7): zero preço/oferta/worker/availability/capability/authority/
//   bank_*/split/payout/certificação · zero console.log · zero ensureUserActor · zero lookup solto.

import { HttpError } from '@core/errors/http-error';
import { professionalC1Repository } from './professional-c1.repository';
import type {
  ConceptRow,
  ConceptDTO,
  ProfessionalC1DTO,
  BioDTO,
  DeclareConceptInput,
  UpdateConceptInput,
} from './professional-c1.types';

// ── Mapeamento de erro de integridade do banco → status limpo [REPARO 3] ──────
// NUNCA propaga 500 cru: traduz unique/FK/check ao HTTP correto.
function mapIntegrityError(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code === '23505') {
    throw HttpError.conflict('Competência já declarada para este concept');
  }
  if (code === '23503') {
    throw HttpError.badRequest('concept_id inválido (concept inexistente)');
  }
  if (code === '23514') {
    throw HttpError.badRequest('Valor fora do permitido (skill_level 1..5 / years_experience 0..80)');
  }
  throw err as Error;
}

function toConceptDTO(row: ConceptRow): ConceptDTO {
  return {
    conceptId: row.concept_id,
    sourceCategoryId: row.source_category_id,
    skillLevel: row.skill_level,
    yearsExperience: row.years_experience,
    isActive: row.is_active,
    declaredAt: row.declared_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  };
}

// ── Validações app-level (erro limpo ANTES do banco; banco é rede de segurança) ─
function assertSkillLevel(v: number): void {
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw HttpError.badRequest('skill_level deve ser inteiro entre 1 e 5');
  }
}
function assertYears(v: number | null | undefined): void {
  if (v === null || v === undefined) return;
  if (!Number.isInteger(v) || v < 0 || v > 80) {
    throw HttpError.badRequest('years_experience deve ser inteiro entre 0 e 80, ou nulo');
  }
}

class ProfessionalC1Service {
  // 🔴 DECISION-0113 fatia 5.2: (0) REPRESENTABILIDADE antes de tudo — o `userId` autenticado precisa
  // poder REPRESENTAR o `actorId` declarado (`canRepresentActor`); não basta o actor existir. É actor-keyed
  // (self / empresa / grupo / delegação). `canRepresentActor` é uniforme (false p/ inexistente E p/ alheio)
  // → 403 SEM vazar a existência de actor de terceiro. Depois: (a) guarda de identidade + (b) invariante.
  private async resolveActorGuarded(tenantId: string, actorId: string, userId: string): Promise<void> {
    let representable = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      representable = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      representable = false; // incerteza no substrato de autoridade = deny fail-closed
    }
    if (!representable) {
      throw new HttpError('Actor não representável pelo usuário autenticado', 403);
    }
    const identity = await professionalC1Repository.getActorIdentityCheck(tenantId, actorId);
    if (!identity) {
      throw HttpError.notFound('Actor não encontrado');
    }
    if (identity.id !== identity.actor_id) {
      // defesa-em-profundidade (banco já força via chk_actors_actor_id_equals_id); fail-closed.
      throw new HttpError('ACTOR_ID_INVARIANT_BROKEN', 500);
    }
  }

  async getProfessionalC1(tenantId: string, actorId: string, userId: string): Promise<ProfessionalC1DTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    const concepts = await professionalC1Repository.listActiveConcepts(tenantId, actorId);
    const profile = await professionalC1Repository.getProfile(tenantId, actorId);
    // actor existe sem declaração ⇒ { concepts: [], professional_bio: null } (leitura NUNCA cria).
    return {
      concepts: concepts.map(toConceptDTO),
      professional_bio: profile?.professional_bio ?? null,
    };
  }

  async updateBio(tenantId: string, actorId: string, bio: string | null, userId: string): Promise<BioDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    const row = await professionalC1Repository.upsertBio(tenantId, actorId, bio);
    return { professional_bio: row.professional_bio };
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareConceptInput,
    userId: string
  ): Promise<ConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    if (!input.conceptId) throw HttpError.badRequest('concept_id é obrigatório');
    assertSkillLevel(input.skillLevel);
    assertYears(input.yearsExperience);
    try {
      const row = await professionalC1Repository.declareConcept(tenantId, actorId, input);
      return toConceptDTO(row);
    } catch (err) {
      mapIntegrityError(err);
    }
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateConceptInput,
    userId: string
  ): Promise<ConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    if (patch.skillLevel !== undefined) assertSkillLevel(patch.skillLevel);
    if (patch.yearsExperience !== undefined) assertYears(patch.yearsExperience);
    try {
      const row = await professionalC1Repository.updateConcept(tenantId, actorId, conceptId, patch);
      if (!row) throw HttpError.notFound('Competência não encontrada');
      return toConceptDTO(row);
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
  ): Promise<ConceptDTO> {
    await this.resolveActorGuarded(tenantId, actorId, userId);
    const row = await professionalC1Repository.retireConcept(tenantId, actorId, conceptId);
    if (!row) throw HttpError.notFound('Competência ativa não encontrada');
    return toConceptDTO(row);
  }
}

export const professionalC1Service = new ProfessionalC1Service();
