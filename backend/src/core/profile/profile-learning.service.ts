// src/core/profile/profile-learning.service.ts
// Serviço para gerenciar perfil de aprendizado/trilha

import { runQueryWithTenant } from '@core/database/pool';
import { identityService } from '../identity/identity.service';
import type {
  LearningProfile,
  UpdateLearningProfileInput,
  LearningCategory,
} from './profile-learning.types';

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

    // Extrair dados do perfil de aprendizado
    const learnings: LearningCategory[] = metadata.learnings || [];
    const preferences = metadata.learningPreferences || {};

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

    // Buscar categorias selecionadas para montar array completo
    let learnings: LearningCategory[] = [];
    if (input.learnings && input.learnings.length > 0) {
      const categoriesResult = await pool.query<{
        category_id: string;
        name: string;
        path: string[];
        level: number;
      }>(
        `
        SELECT category_id, name, path, level
        FROM categories
        WHERE category_id = ANY($1::uuid[])
          AND (status IS NULL OR status = 'active' OR status = 'auto_active')
        `,
        [input.learnings]
      );

      learnings = categoriesResult.rows.map((row) => ({
        categoryId: row.category_id,
        categoryName: row.name,
        categoryPath: row.path,
        level: row.level,
      }));
    }

    // Atualizar metadata com novos dados
    const updatedMetadata = {
      ...currentMetadata,
      learnings,
      learningPreferences: input.preferences || currentMetadata.learningPreferences || {},
      learningMetadata: input.metadata || currentMetadata.learningMetadata || {},
    };

    // Atualizar no banco
    await pool.query(
      `
      UPDATE global_users
      SET metadata = $1::jsonb, updated_at = now()
      WHERE global_user_id = $2
      `,
      [JSON.stringify(updatedMetadata), globalUserId]
    );

    return {
      globalUserId,
      learnings,
      preferences: input.preferences || currentMetadata.learningPreferences || {},
      metadata: input.metadata || currentMetadata.learningMetadata || {},
    };
  }
}

export const profileLearningService = new ProfileLearningService();













