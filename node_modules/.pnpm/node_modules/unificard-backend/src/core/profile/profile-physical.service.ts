// src/core/profile/profile-physical.service.ts
// Serviço para gerenciar perfil físico/interesses

import { runQueryWithTenant } from '@core/database/pool';
import { identityService } from '../identity/identity.service';
import type {
  PhysicalProfile,
  UpdatePhysicalProfileInput,
  LifestyleInfo,
  InterestCategory,
} from './profile-physical.types';

class ProfilePhysicalService {
  /**
   * Busca perfil físico/interesses do usuário
   */
  async getPhysicalProfile(
    tenantId: string,
    userId: string
  ): Promise<PhysicalProfile | null> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      return null;
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar interesses do usuário (armazenados no metadata do global_user ou em tabela separada)
    const { pool } = await import('@core/database/pool');
    // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
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

    // Extrair dados do perfil físico
    const interests: InterestCategory[] = metadata.interests || [];
    const lifestyle: LifestyleInfo = metadata.lifestyle || {
      drinks: null,
      smokes: null,
      relationshipStatus: null,
      sexualOrientation: null,
    };
    const preferences = metadata.preferences || {};

    return {
      globalUserId,
      interests,
      lifestyle,
      preferences,
      metadata: metadata.physicalMetadata || {},
    };
  }

  /**
   * Atualiza perfil físico/interesses
   */
  async updatePhysicalProfile(
    tenantId: string,
    userId: string,
    input: UpdatePhysicalProfileInput
  ): Promise<PhysicalProfile> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      throw new Error('Identidade do usuário não encontrada');
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar metadata atual
    // 🔴 NOTA: global_users não tem RLS, então não precisa de tenant_id no WHERE
    // Mas adicionamos ORDER BY updated_at DESC como garantia de registro mais recente
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

    // Atualizar metadata com novos dados
    const updatedMetadata = {
      ...currentMetadata,
      interests: input.interests || currentMetadata.interests || [],
      lifestyle: {
        ...(currentMetadata.lifestyle || {}),
        ...(input.lifestyle || {}),
      },
      preferences: {
        ...(currentMetadata.preferences || {}),
        ...(input.preferences || {}),
      },
      physicalMetadata: {
        ...(currentMetadata.physicalMetadata || {}),
        ...(input.metadata || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    // Atualizar no banco
    await pool.query(
      `
      UPDATE global_users
      SET metadata = $1, updated_at = now()
      WHERE global_user_id = $2
      `,
      [JSON.stringify(updatedMetadata), globalUserId]
    );

    // Buscar categorias para montar o retorno completo
    const { categoriesService } = await import('../categories/categories.service');
    const interestsWithDetails: InterestCategory[] = [];
    
    if (updatedMetadata.interests && Array.isArray(updatedMetadata.interests)) {
      for (const categoryId of updatedMetadata.interests) {
        const category = await categoriesService.getCategoryById(categoryId);
        if (category) {
          interestsWithDetails.push({
            categoryId: category.categoryId,
            categoryName: category.name,
            categoryPath: category.path,
            level: category.level,
          });
        }
      }
    }

    return {
      globalUserId,
      interests: interestsWithDetails,
      lifestyle: updatedMetadata.lifestyle,
      preferences: updatedMetadata.preferences || {},
      metadata: updatedMetadata.physicalMetadata || {},
    };
  }
}

export const profilePhysicalService = new ProfilePhysicalService();



