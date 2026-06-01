// src/core/profile/profile-learning.service.ts
// Serviço para gerenciar perfil de aprendizado/trilha
//
// 🔴 BLINDAGEM CANÔNICA: Aprendizado representa direção e interesse declarado
// - NÃO mede capacidade, NÃO valida competência, NÃO bloqueia funcionalidades
// - Progresso (beginner/intermediate/advanced) representa fase de exploração, não nível
// - Por que isso NÃO pode virar decisão: aprendizado é autodireção, não validação

import { identityService } from '../identity/identity.service';
import type {
  LearningProfile,
  LearningCategory,
} from './profile-learning.types';
import {
  assertStoredProfileCategoryIdsStrict,
  enrichCategoryNavigationByIds,
} from './category-navigation-bridge';
// Fatia 5 (DECISION-0067): a ESCRITA de Aprendizado saiu do blob `global_users.metadata` para o C1
// (`/profile/learning/c1` → `actor_learning_concepts`). O método legado `updateLearningProfile` (que
// gravava `metadata.learnings`/`learningPreferences`/`learningMetadata`) foi REMOVIDO; a rota PUT /profile/
// learning responde 501. `getLearningProfile` permanece (leitura; o blob não guarda mais `learnings` —
// cleanup pela migration 20260601160000 — então retorna lista vazia).

class ProfileLearningService {
  /**
   * Busca perfil de aprendizado do usuário
   */
  async getLearningProfile(
    tenantId: string,
    userId: string
  ): Promise<LearningProfile | null> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      return null;
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar aprendizados do usuário (armazenados no metadata do global_user)
    const { pool } = await import('@core/database/pool');
    const userRow = await pool.query<{
      metadata: any;
    }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );

    const metadata = userRow.rows[0]?.metadata || {};

    const preferences = metadata.learningPreferences || {};
    const learningIds = assertStoredProfileCategoryIdsStrict(metadata.learnings, 'learnings');
    const baseRows = await enrichCategoryNavigationByIds(pool, learningIds, 'learning');
    const learnings: LearningCategory[] = baseRows.map((row) => {
      const pref = preferences[row.categoryId] || {};
      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryPath: row.categoryPath,
        level: row.level,
        progress: pref.progress ?? null,
        preferences:
          pref && (pref.details?.length || pref.notes || pref.progress != null)
            ? {
                progress: pref.progress,
                details: pref.details,
                notes: pref.notes,
              }
            : undefined,
      };
    });

    return {
      globalUserId,
      learnings,
      preferences,
      metadata: metadata.learningMetadata || {},
    };
  }

  // updateLearningProfile REMOVIDO (Fatia 5) — a escrita de Aprendizado é o C1 /profile/learning/c1.
  // A rota PUT /profile/learning responde 501. Nenhum fluxo ativo grava `learnings` no blob.
}

export const profileLearningService = new ProfileLearningService();



























