// src/core/profile/profile-physical.service.ts
// Serviço para gerenciar perfil físico/interesses

import { identityService } from '../identity/identity.service';
import type {
  PhysicalProfile,
  UpdatePhysicalProfileInput,
  LifestyleInfo,
  InterestCategory,
} from './profile-physical.types';
import { profileHealthFactsRepository } from './profile-health-facts.repository';
import { profileHealthTaxonomyRepository } from './profile-health-taxonomy.repository';
import {
  assertStoredProfileCategoryIdsStrict,
  assertWritePayloadCategoryIdsOnly,
  enrichCategoryNavigationByIds,
  requireCategoriesWithConceptForScope,
} from './category-navigation-bridge';

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
    // 🔴 CORREÇÃO: ORDER BY updatedAt DESC para garantir registro mais recente
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

    const interestIds = assertStoredProfileCategoryIdsStrict(metadata.interests, 'interests');
    const interests: InterestCategory[] = await enrichCategoryNavigationByIds(
      pool,
      interestIds,
      'interest',
    ).then((rows) =>
      rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryPath: row.categoryPath,
        level: row.level,
      })),
    );
    const lifestyle: LifestyleInfo = metadata.lifestyle || {
      drinks: null,
      smokes: null,
      relationshipStatus: null,
      sexualOrientation: null,
    };
    const preferences = metadata.preferences || {};

    // Dados de saúde (consentimento): falha propaga — sem retorno parcial silencioso
    let healthData: { height?: number; weight?: number; idealWeight?: number } | null = null;
    const actorResult = await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
      [tenantId, userId],
    );
    const actorId = actorResult.rows[0]?.actor_id;
    if (actorId) {
      const shareConsentTax = await profileHealthTaxonomyRepository.findBySlug(
        tenantId,
        'compartilhar-perfil-relacionamento',
      );

      if (shareConsentTax) {
        const shareConsentFact = await profileHealthFactsRepository.findByTaxonomyId(
          tenantId,
          actorId,
          shareConsentTax.taxonomyId,
        );

        if (shareConsentFact?.valueBoolean === true) {
          const heightTax = await profileHealthTaxonomyRepository.findBySlug(tenantId, 'altura');
          const weightTax = await profileHealthTaxonomyRepository.findBySlug(tenantId, 'peso');

          let height: number | undefined;
          let weight: number | undefined;

          if (heightTax) {
            const heightFact = await profileHealthFactsRepository.findByTaxonomyId(
              tenantId,
              actorId,
              heightTax.taxonomyId,
            );
            if (heightFact?.valueNumber) {
              height = heightFact.valueNumber;
            }
          }

          if (weightTax) {
            const weightFact = await profileHealthFactsRepository.findByTaxonomyId(
              tenantId,
              actorId,
              weightTax.taxonomyId,
            );
            if (weightFact?.valueNumber) {
              weight = weightFact.valueNumber;
            }
          }

          if (height || weight) {
            healthData = { height, weight };

            if (height && weight) {
              const heightInMeters = height / 100;
              const idealWeight = 22.5 * (heightInMeters * heightInMeters);
              healthData.idealWeight = Math.round(idealWeight * 10) / 10;
            }
          }
        }
      }
    }

    return {
      globalUserId,
      interests,
      lifestyle,
      preferences,
      metadata: {
        ...(metadata.physicalMetadata || {}),
        ...(healthData ? { sharedHealthData: healthData } : {}),
      },
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
    // Mas adicionamos ORDER BY updatedAt DESC como garantia de registro mais recente
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

    const nextInterestIds =
      input.interests !== undefined
        ? assertWritePayloadCategoryIdsOnly(input.interests, 'interests')
        : assertStoredProfileCategoryIdsStrict(currentMetadata.interests, 'interests');

    if (nextInterestIds.length > 0) {
      await requireCategoriesWithConceptForScope(pool, nextInterestIds, 'interest');
    }

    const updatedMetadata = {
      ...currentMetadata,
      interests: nextInterestIds,
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

    await pool.query(
      `
      UPDATE global_users
      SET metadata = $1, updated_at = now()
      WHERE global_user_id = $2
      `,
      [JSON.stringify(updatedMetadata), globalUserId]
    );

    const interestsWithDetails: InterestCategory[] = await enrichCategoryNavigationByIds(
      pool,
      nextInterestIds,
      'interest',
    ).then((rows) =>
      rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryPath: row.categoryPath,
        level: row.level,
      })),
    );

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








