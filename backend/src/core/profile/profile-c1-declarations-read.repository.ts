// backend/src/core/profile/profile-c1-declarations-read.repository.ts
//
// F1 (DECISION-0069) — READ-ONLY. Acesso de leitura às declarações C1 (learning/interest) por actor,
// para readers user-scoped (profile-inference/opportunity/core — migração futura F2–F4).
//
// COLUNAS EXPLÍCITAS; SEM SELECT *. NUNCA escreve. NUNCA cria actor (sem ensureUserActor). NUNCA lê
// global_users.metadata. Fonte: view read-only `actor_concept_declarations_v` (UNION C1) + LEFT JOIN
// `categories` (breadcrumb opcional). `concept_id` = identidade; `source_category_id` = breadcrumb nullable.

import { runQueriesWithTenant } from '@core/database/pool';

export interface UserActorRow {
  actor_id: string;
}

export interface C1DeclarationRow {
  declaration_kind: 'learning' | 'interest' | 'professional';
  concept_id: string;
  source_category_id: string | null;
  learning_progress: number | null;
  category_name: string | null;
  category_path: string[] | null;
}

class ProfileC1DeclarationsReadRepository {
  // Resolve o(s) actor(es) 'user' de um userId no tenant. Retorna TODAS as linhas (o service decide
  // sobre 0 = vazio / 1 = ok / >1 = ambíguo). NÃO cria actor. Sem global_user_id como identidade final.
  async findUserActors(tenantId: string, userId: string): Promise<UserActorRow[]> {
    return runQueriesWithTenant<UserActorRow>(
      tenantId,
      `SELECT actor_id
         FROM actors
        WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`,
      [tenantId, userId]
    );
  }

  // Declarações C1 ATIVAS de learning/interest do actor, com breadcrumb opcional resolvido por LEFT JOIN.
  // declaration_kind='professional' é EXCLUÍDO (fora do escopo desta leitura).
  async listActiveLearningInterestDeclarations(
    tenantId: string,
    actorId: string
  ): Promise<C1DeclarationRow[]> {
    return runQueriesWithTenant<C1DeclarationRow>(
      tenantId,
      `SELECT d.declaration_kind,
              d.concept_id,
              d.source_category_id,
              d.learning_progress,
              c.name AS category_name,
              c.path AS category_path
         FROM actor_concept_declarations_v d
         LEFT JOIN categories c ON c.category_id = d.source_category_id
        WHERE d.tenant_id = $1
          AND d.actor_id = $2
          AND d.declaration_kind IN ('learning', 'interest')
          AND d.is_active = true
        ORDER BY d.declaration_kind, d.declared_at`,
      [tenantId, actorId]
    );
  }
}

export const profileC1DeclarationsReadRepository = new ProfileC1DeclarationsReadRepository();
