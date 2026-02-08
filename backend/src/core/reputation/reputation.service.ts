// backend/src/core/reputation/reputation.service.ts
import { runQueryWithTenant } from '@core/database/pool';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import type {
  ReputationRow,
  ReputationScore,
  ReviewCreatedEventPayload,
} from './reputation.types';

class ReputationService {
  private toScore(row: ReputationRow): ReputationScore {
    return {
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityGlobalUserId: row.entity_global_user_id ?? undefined,
      globalScore: Number(row.global_score),
      ratingCount: row.rating_count,
      lastRatingAt: row.last_ratingAt ?? undefined,
      qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
      punctualityScore: row.punctuality_score
        ? Number(row.punctuality_score)
        : undefined,
      professionalismScore: row.professionalism_score
        ? Number(row.professionalism_score)
        : undefined,
      updatedAt: row.updatedAt,
    };
  }

  async getScore(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<ReputationScore | null> {
    const row = await runQueryWithTenant<ReputationRow>(
      tenantId,
      `
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_ratingAt, quality_score, punctuality_score, professionalism_score, updatedAt
      FROM reputation_scores
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
      `,
      [tenantId, entityType, entityId],
    );

    return row ? this.toScore(row) : null;
  }

  /**
   * Busca reputação por global_user_id
   * Agrega scores de todos os tenants onde o usuário tem reputação
   * NOTA: Esta função não usa RLS pois precisa buscar em múltiplos tenants
   */
  async getScoreByGlobalUserId(globalUserId: string): Promise<{
    globalUserId: string;
    scores: {
      global: number;
      work?: number;
      rides?: number;
      events?: number;
      commerce?: number;
    };
    summary: {
      totalReviews: number;
      lastReviewAt?: string;
      averageScore: number;
    };
  } | null> {
    // Buscar todas as reputações deste global_user_id (sem RLS para buscar em múltiplos tenants)
    const { pool } = await import('@core/database/pool');
    const result = await pool.query<ReputationRow>(
      `
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_ratingAt, quality_score, punctuality_score, professionalism_score, updatedAt
      FROM reputation_scores
      WHERE entity_global_user_id = $1
      ORDER BY updatedAt DESC
      `,
      [globalUserId],
    );
    const rows = result.rows;

    if (!rows || rows.length === 0) {
      return null;
    }

    // Agregar scores por módulo
    const scores: any = { global: 0 };
    let totalReviews = 0;
    let totalScore = 0;
    let lastReviewAt: string | undefined;

    for (const row of rows) {
      const score = Number(row.global_score);
      const count = row.rating_count;
      totalReviews += count;
      totalScore += score * count;

      if (row.last_ratingAt && (!lastReviewAt || row.last_ratingAt > lastReviewAt)) {
        lastReviewAt = row.last_ratingAt;
      }

      // Mapear source_module para scores
      const moduleMap: Record<string, string> = {
        work: 'work',
        rides: 'rides',
        events: 'events',
        commerce: 'commerce',
      };

      // Tentar inferir módulo do entity_type ou usar source_module se disponível
      if (row.entity_type === 'worker') {
        scores.work = score;
      } else if (row.entity_type === 'driver') {
        scores.rides = score;
      }
    }

    const averageScore = totalReviews > 0 ? totalScore / totalReviews : 0;
    scores.global = averageScore;

    return {
      globalUserId,
      scores,
      summary: {
        totalReviews,
        lastReviewAt,
        averageScore,
      },
    };
  }

  /**
   * Atualiza reputação incrementalmente com base em um novo review.
   * Estratégia simples:
   * new_avg = (old_avg * n + rating) / (n+1)
   */
  async applyReview(
    tenantId: string,
    payload: ReviewCreatedEventPayload,
  ): Promise<ReputationScore> {
    const existing = await runQueryWithTenant<ReputationRow>(
      tenantId,
      `
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_ratingAt, quality_score, punctuality_score, professionalism_score, updatedAt
      FROM reputation_scores
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
      `,
      [tenantId, payload.entityType, payload.entityId],
    );

    // Resolver global_user_id se entity_type for relacionado a usuário
    let entityGlobalUserId: string | null = null;
    if (payload.entityType === 'worker' || payload.entityType === 'client_user') {
      entityGlobalUserId = await resolveGlobalUserId(payload.entityId, tenantId);
    }

    let newGlobal: number;
    let newCount: number;
    let newQuality: number | null = null;
    let newPunctuality: number | null = null;
    let newProfessionalism: number | null = null;

    if (!existing) {
      newCount = 1;
      newGlobal = payload.rating;
      newQuality = payload.qualityRating ?? null;
      newPunctuality = payload.punctualityRating ?? null;
      newProfessionalism = payload.professionalismRating ?? null;
    } else {
      const oldCount = existing.rating_count;
      newCount = oldCount + 1;

      const oldGlobal = Number(existing.global_score);
      newGlobal = (oldGlobal * oldCount + payload.rating) / newCount;

      if (payload.qualityRating != null) {
        const oldQ = existing.quality_score
          ? Number(existing.quality_score)
          : payload.qualityRating;
        newQuality = (oldQ * oldCount + payload.qualityRating) / newCount;
      } else {
        newQuality = existing.quality_score
          ? Number(existing.quality_score)
          : null;
      }

      if (payload.punctualityRating != null) {
        const oldP = existing.punctuality_score
          ? Number(existing.punctuality_score)
          : payload.punctualityRating;
        newPunctuality =
          (oldP * oldCount + payload.punctualityRating) / newCount;
      } else {
        newPunctuality = existing.punctuality_score
          ? Number(existing.punctuality_score)
          : null;
      }

      if (payload.professionalismRating != null) {
        const oldProf = existing.professionalism_score
          ? Number(existing.professionalism_score)
          : payload.professionalismRating;
        newProfessionalism =
          (oldProf * oldCount + payload.professionalismRating) / newCount;
      } else {
        newProfessionalism = existing.professionalism_score
          ? Number(existing.professionalism_score)
          : null;
      }
    }

    const row = await runQueryWithTenant<ReputationRow>(
      tenantId,
      `
      INSERT INTO reputation_scores (
        tenant_id,
        entity_type,
        entity_id,
        entity_global_user_id,
        global_score,
        rating_count,
        last_ratingAt,
        quality_score,
        punctuality_score,
        professionalism_score,
        updatedAt
      )
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,now())
      ON CONFLICT (tenant_id, entity_type, entity_id)
      DO UPDATE SET
        entity_global_user_id = COALESCE(EXCLUDED.entity_global_user_id, reputation_scores.entity_global_user_id),
        global_score = EXCLUDED.global_score,
        rating_count = EXCLUDED.rating_count,
        last_ratingAt = EXCLUDED.last_ratingAt,
        quality_score = EXCLUDED.quality_score,
        punctuality_score = EXCLUDED.punctuality_score,
        professionalism_score = EXCLUDED.professionalism_score,
        updatedAt = now()
      RETURNING tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_ratingAt, quality_score, punctuality_score, professionalism_score, updatedAt
      `,
      [
        tenantId,
        payload.entityType,
        payload.entityId,
        entityGlobalUserId,
        newGlobal,
        newCount,
        newQuality,
        newPunctuality,
        newProfessionalism,
      ],
    );

    if (!row) {
      throw new Error('Failed to upsert reputation score');
    }

    return this.toScore(row);
  }
}

export const reputationService = new ReputationService();

