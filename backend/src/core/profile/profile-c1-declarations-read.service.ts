// backend/src/core/profile/profile-c1-declarations-read.service.ts
//
// F1 (DECISION-0069) — READ-SERVICE compartilhado para readers backend user-scoped lerem Learning/Interest
// a partir do C1 actor-first/concept-first. NÃO migra consumidores nesta fatia (profile-inference/
// opportunity/core seguem como estão); apenas entrega a infraestrutura de leitura reutilizável.
//
// Regras (DECISION-0069):
// - readers user-scoped resolvem `userId → actors.actor_id` onde tenant_id+user_id+actor_type='user';
// - NUNCA cria actor (sem ensureUserActor); sem global_user_id como identidade operacional final;
// - sem actor → vazio controlado ({ actorId: null, learning: [], interests: [] });
// - >1 actor 'user' → falha fechada explícita `USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS`;
// - fonte = view `actor_concept_declarations_v` (concept_id = identidade); source_category_id é breadcrumb
//   opcional (LEFT JOIN categories) — se nulo/irresolúvel, NÃO inventar categoria;
// - sem fallback conceptId ← categoryId; sem Professional; sem Lifestyle/Saúde; sem escrita; sem financeiro.

import { profileC1DeclarationsReadRepository } from './profile-c1-declarations-read.repository';

export type LearningProgressLabel = 'beginner' | 'intermediate' | 'advanced';

export interface C1LearningDeclaration {
  conceptId: string;
  sourceCategoryId: string | null;
  categoryName: string | null;
  categoryPath: string[];
  progress: LearningProgressLabel | null;
  progressLevel: 1 | 2 | 3 | null;
}

export interface C1InterestDeclaration {
  conceptId: string;
  sourceCategoryId: string | null;
  categoryName: string | null;
  categoryPath: string[];
}

export interface UserC1ConceptDeclarations {
  actorId: string | null;
  learning: C1LearningDeclaration[];
  interests: C1InterestDeclaration[];
}

// Erro de fronteira: mais de um actor 'user' para o mesmo userId (ambiguidade de identidade operacional).
export class UserActorAmbiguousError extends Error {
  readonly code = 'USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS';
  constructor(tenantId: string, userId: string, count: number) {
    super(
      `USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS: ${count} actors 'user' para userId=${userId} no tenant=${tenantId}`
    );
    this.name = 'UserActorAmbiguousError';
  }
}

function toProgressLevel(raw: number | null): 1 | 2 | 3 | null {
  return raw === 1 || raw === 2 || raw === 3 ? raw : null;
}

function toProgressLabel(level: 1 | 2 | 3 | null): LearningProgressLabel | null {
  return level === 1 ? 'beginner' : level === 2 ? 'intermediate' : level === 3 ? 'advanced' : null;
}

class ProfileC1DeclarationsReadService {
  // Resolve o actor 'user' do userId. NÃO cria actor. 0 → null; 1 → actorId; >1 → erro fechado.
  async resolveUserActorId(tenantId: string, userId: string): Promise<string | null> {
    const rows = await profileC1DeclarationsReadRepository.findUserActors(tenantId, userId);
    if (rows.length === 0) return null;
    if (rows.length > 1) throw new UserActorAmbiguousError(tenantId, userId, rows.length);
    return rows[0].actor_id;
  }

  // Entrada principal para readers: declarações Learning + Interest do actor 'user' do userId.
  async getUserActorConceptDeclarationsForProfile(
    tenantId: string,
    userId: string
  ): Promise<UserC1ConceptDeclarations> {
    const actorId = await this.resolveUserActorId(tenantId, userId);
    if (!actorId) {
      return { actorId: null, learning: [], interests: [] };
    }

    const rows = await profileC1DeclarationsReadRepository.listActiveLearningInterestDeclarations(
      tenantId,
      actorId
    );

    const learning: C1LearningDeclaration[] = [];
    const interests: C1InterestDeclaration[] = [];

    for (const row of rows) {
      const categoryPath = Array.isArray(row.category_path) ? row.category_path : [];
      if (row.declaration_kind === 'learning') {
        const progressLevel = toProgressLevel(row.learning_progress);
        learning.push({
          conceptId: row.concept_id,
          sourceCategoryId: row.source_category_id,
          categoryName: row.category_name,
          categoryPath,
          progress: toProgressLabel(progressLevel),
          progressLevel,
        });
      } else if (row.declaration_kind === 'interest') {
        interests.push({
          conceptId: row.concept_id,
          sourceCategoryId: row.source_category_id,
          categoryName: row.category_name,
          categoryPath,
        });
      }
      // 'professional' já é excluído na query — ignorado aqui por segurança.
    }

    return { actorId, learning, interests };
  }

  // Conveniência (mesma resolução de actor): só Learning.
  async getUserLearningDeclarationsForProfile(
    tenantId: string,
    userId: string
  ): Promise<{ actorId: string | null; learning: C1LearningDeclaration[] }> {
    const result = await this.getUserActorConceptDeclarationsForProfile(tenantId, userId);
    return { actorId: result.actorId, learning: result.learning };
  }

  // Conveniência (mesma resolução de actor): só Interest.
  async getUserInterestDeclarationsForProfile(
    tenantId: string,
    userId: string
  ): Promise<{ actorId: string | null; interests: C1InterestDeclaration[] }> {
    const result = await this.getUserActorConceptDeclarationsForProfile(tenantId, userId);
    return { actorId: result.actorId, interests: result.interests };
  }
}

export const profileC1DeclarationsReadService = new ProfileC1DeclarationsReadService();
