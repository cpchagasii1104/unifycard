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
  UpdateLearningProfileInput,
  LearningCategory,
} from './profile-learning.types';
import {
  assertStoredProfileCategoryIdsStrict,
  assertWritePayloadCategoryIdsOnly,
  enrichCategoryNavigationByIds,
  requireCategoriesWithConceptForScope,
} from './category-navigation-bridge';

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

  /**
   * Atualiza perfil de aprendizado
   */
  async updateLearningProfile(
    tenantId: string,
    userId: string,
    input: UpdateLearningProfileInput
  ): Promise<LearningProfile> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      throw new Error('Identidade do usuário não encontrada');
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar metadata atual
    const { pool } = await import('@core/database/pool');
    const currentRow = await pool.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );

    const currentMetadata = currentRow.rows[0]?.metadata || {};

    const nextLearningIds =
      input.learnings !== undefined
        ? assertWritePayloadCategoryIdsOnly(input.learnings, 'learnings')
        : assertStoredProfileCategoryIdsStrict(currentMetadata.learnings, 'learnings');

    if (nextLearningIds.length > 0) {
      await requireCategoriesWithConceptForScope(pool, nextLearningIds, 'learning');
    }

    const nextPreferences =
      input.preferences !== undefined ? input.preferences : currentMetadata.learningPreferences || {};
    const nextLearningMeta =
      input.metadata !== undefined ? input.metadata : currentMetadata.learningMetadata || {};

    const updatedMetadata = {
      ...currentMetadata,
      learnings: nextLearningIds,
      learningPreferences: nextPreferences,
      learningMetadata: nextLearningMeta,
    };

    await pool.query(
      `
      UPDATE global_users
      SET metadata = $1::jsonb, updated_at = now()
      WHERE global_user_id = $2
      `,
      [JSON.stringify(updatedMetadata), globalUserId]
    );

    const baseRows = await enrichCategoryNavigationByIds(pool, nextLearningIds, 'learning');
    const learnings: LearningCategory[] = baseRows.map((row) => {
      const pref = nextPreferences[row.categoryId] || {};
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
      preferences: nextPreferences,
      metadata: nextLearningMeta,
    };
  }
}

export const profileLearningService = new ProfileLearningService();



























