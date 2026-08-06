// backend/src/core/profile/professional-c1/professional-c1.repository.ts
//
// C1 — acesso às 2 tabelas do substrato profissional declarativo.
// COLUNAS EXPLÍCITAS sempre; SEM SELECT *; tenant_id=$1 explícito em TODA query.
// actorId usado = valor recebido (actionContext.actorId já resolvido). NENHUMA criação de actor.
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — é a METADE PF do gate de publicação de serviço
// ║ NORMA:   DECISION-0144 · DECISION-0147 Q2/Q3 (espelhado em
// ║          services-offering-activation-gate.ts e canonical-service.service.ts::searchOfferable)
// ║ NÃO:     NÃO criar outra casa de "o que esta pessoa faz" — nem em metadata, nem em perfil
// ║ EM VEZ:  PF declara aqui (actor_professional_concepts) · PJ publica em
// ║          company_concept_publications. Não há terceira porta.
// ╚════════════════════════════════════════════════════════════════
//
// ⚠️ MIGALHA DE 2026-08-06. `actor_professional_profiles` tem 0 linhas (ninguém preencheu bio) e eu
// quase a classifiquei como cadáver numa auditoria — **errado**: o writer é VIVO e está logo abaixo
// (`upsertBio`), com harness. **Dormente ≠ morto.**
//
// 📌 E o que estas duas tabelas alimentam, medido em 2026-08-06: o **matching de demanda**
// (`/oportunidades?matching=true`) passou a ler a UNIÃO das duas metades do gate — profissão ATIVA
// **ou** oferta ATIVA no mesmo concept (GO Clayton). Antes lia só esta metade, e por isso as 8
// páginas com 14 ofertas **nunca** casavam com demanda nenhuma.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ProfileRow,
  ConceptRow,
  ActorIdentityCheckRow,
  DeclareConceptInput,
  UpdateConceptInput,
} from './professional-c1.types';

const PROFILE_COLS =
  'id, tenant_id, actor_id, professional_bio, created_at, updated_at';
const CONCEPT_COLS =
  'id, tenant_id, actor_id, concept_id, source_category_id, skill_level, ' +
  'years_experience, is_active, declared_at, updated_at, retired_at';

class ProfessionalC1Repository {
  // REPARO 2 — read dedicado (id E actor_id) para a guarda de invariante; read-only.
  // findById vivo NÃO traz `id` (só actor_id) → método próprio, colunas explícitas.
  // NÃO é lookup solto: actorId já resolvido; não resolve user/global_user → actor.
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

  async getProfile(
    tenantId: string,
    actorId: string
  ): Promise<ProfileRow | undefined> {
    return runQueryWithTenant<ProfileRow>(
      tenantId,
      `SELECT ${PROFILE_COLS}
         FROM actor_professional_profiles
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1`,
      [tenantId, actorId]
    );
  }

  async upsertBio(
    tenantId: string,
    actorId: string,
    bio: string | null
  ): Promise<ProfileRow> {
    const row = await runQueryWithTenant<ProfileRow>(
      tenantId,
      `INSERT INTO actor_professional_profiles (tenant_id, actor_id, professional_bio)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, actor_id)
       DO UPDATE SET professional_bio = EXCLUDED.professional_bio, updated_at = now()
       RETURNING ${PROFILE_COLS}`,
      [tenantId, actorId, bio]
    );
    if (!row) throw new Error('upsertBio: RETURNING vazio inesperado');
    return row;
  }

  async listActiveConcepts(
    tenantId: string,
    actorId: string
  ): Promise<ConceptRow[]> {
    return runQueriesWithTenant<ConceptRow>(
      tenantId,
      `SELECT ${CONCEPT_COLS}
         FROM actor_professional_concepts
        WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
        ORDER BY declared_at`,
      [tenantId, actorId]
    );
  }

  async declareConcept(
    tenantId: string,
    actorId: string,
    input: DeclareConceptInput
  ): Promise<ConceptRow> {
    const row = await runQueryWithTenant<ConceptRow>(
      tenantId,
      `INSERT INTO actor_professional_concepts
         (tenant_id, actor_id, concept_id, source_category_id, skill_level, years_experience)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CONCEPT_COLS}`,
      [
        tenantId,
        actorId,
        input.conceptId,
        input.sourceCategoryId ?? null,
        input.skillLevel,
        input.yearsExperience ?? null,
      ]
    );
    if (!row) throw new Error('declareConcept: RETURNING vazio inesperado');
    return row;
  }

  async updateConcept(
    tenantId: string,
    actorId: string,
    conceptId: string,
    patch: UpdateConceptInput
  ): Promise<ConceptRow | undefined> {
    const sets: string[] = [];
    const values: unknown[] = [tenantId, actorId, conceptId];
    let i = 4;

    if (patch.skillLevel !== undefined) {
      sets.push(`skill_level = $${i++}`);
      values.push(patch.skillLevel);
    }
    if (patch.yearsExperience !== undefined) {
      sets.push(`years_experience = $${i++}`);
      values.push(patch.yearsExperience);
    }
    if (patch.reactivate === true) {
      // ciclo binário: ativa ⇒ retired_at NULL (honra chk_actor_professional_concepts_lifecycle)
      sets.push(`is_active = true`);
      sets.push(`retired_at = NULL`);
    }

    // sempre toca updated_at; se nada material veio, ainda assim não inventa estado.
    sets.push(`updated_at = now()`);

    return runQueryWithTenant<ConceptRow>(
      tenantId,
      `UPDATE actor_professional_concepts
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
  ): Promise<ConceptRow | undefined> {
    return runQueryWithTenant<ConceptRow>(
      tenantId,
      `UPDATE actor_professional_concepts
          SET is_active = false, retired_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true
        RETURNING ${CONCEPT_COLS}`,
      [tenantId, actorId, conceptId]
    );
  }
}

export const professionalC1Repository = new ProfessionalC1Repository();
