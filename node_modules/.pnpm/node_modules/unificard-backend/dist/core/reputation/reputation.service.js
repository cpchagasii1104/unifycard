"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reputationService = void 0;
// backend/src/core/reputation/reputation.service.ts
const pool_1 = require("@core/database/pool");
const identity_utils_1 = require("@core/identity/identity.utils");
class ReputationService {
    toScore(row) {
        return {
            tenantId: row.tenant_id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            entityGlobalUserId: row.entity_global_user_id ?? undefined,
            globalScore: Number(row.global_score),
            ratingCount: row.rating_count,
            lastRatingAt: row.last_rating_at ?? undefined,
            qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
            punctualityScore: row.punctuality_score
                ? Number(row.punctuality_score)
                : undefined,
            professionalismScore: row.professionalism_score
                ? Number(row.professionalism_score)
                : undefined,
            updatedAt: row.updated_at,
        };
    }
    async getScore(tenantId, entityType, entityId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_rating_at, quality_score, punctuality_score, professionalism_score, updated_at
      FROM reputation_scores
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
      `, [tenantId, entityType, entityId]);
        return row ? this.toScore(row) : null;
    }
    /**
     * Busca reputação por global_user_id
     * Agrega scores de todos os tenants onde o usuário tem reputação
     * NOTA: Esta função não usa RLS pois precisa buscar em múltiplos tenants
     */
    async getScoreByGlobalUserId(globalUserId) {
        // Buscar todas as reputações deste global_user_id (sem RLS para buscar em múltiplos tenants)
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const result = await pool.query(`
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_rating_at, quality_score, punctuality_score, professionalism_score, updated_at
      FROM reputation_scores
      WHERE entity_global_user_id = $1
      ORDER BY updated_at DESC
      `, [globalUserId]);
        const rows = result.rows;
        if (!rows || rows.length === 0) {
            return null;
        }
        // Agregar scores por módulo
        const scores = { global: 0 };
        let totalReviews = 0;
        let totalScore = 0;
        let lastReviewAt;
        for (const row of rows) {
            const score = Number(row.global_score);
            const count = row.rating_count;
            totalReviews += count;
            totalScore += score * count;
            if (row.last_rating_at && (!lastReviewAt || row.last_rating_at > lastReviewAt)) {
                lastReviewAt = row.last_rating_at;
            }
            // Mapear source_module para scores
            const moduleMap = {
                work: 'work',
                rides: 'rides',
                events: 'events',
                commerce: 'commerce',
            };
            // Tentar inferir módulo do entity_type ou usar source_module se disponível
            if (row.entity_type === 'worker') {
                scores.work = score;
            }
            else if (row.entity_type === 'driver') {
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
    async applyReview(tenantId, payload) {
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_rating_at, quality_score, punctuality_score, professionalism_score, updated_at
      FROM reputation_scores
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
      `, [tenantId, payload.entityType, payload.entityId]);
        // Resolver global_user_id se entity_type for relacionado a usuário
        let entityGlobalUserId = null;
        if (payload.entityType === 'worker' || payload.entityType === 'client_user') {
            entityGlobalUserId = await (0, identity_utils_1.resolveGlobalUserId)(payload.entityId, tenantId);
        }
        let newGlobal;
        let newCount;
        let newQuality = null;
        let newPunctuality = null;
        let newProfessionalism = null;
        if (!existing) {
            newCount = 1;
            newGlobal = payload.rating;
            newQuality = payload.qualityRating ?? null;
            newPunctuality = payload.punctualityRating ?? null;
            newProfessionalism = payload.professionalismRating ?? null;
        }
        else {
            const oldCount = existing.rating_count;
            newCount = oldCount + 1;
            const oldGlobal = Number(existing.global_score);
            newGlobal = (oldGlobal * oldCount + payload.rating) / newCount;
            if (payload.qualityRating != null) {
                const oldQ = existing.quality_score
                    ? Number(existing.quality_score)
                    : payload.qualityRating;
                newQuality = (oldQ * oldCount + payload.qualityRating) / newCount;
            }
            else {
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
            }
            else {
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
            }
            else {
                newProfessionalism = existing.professionalism_score
                    ? Number(existing.professionalism_score)
                    : null;
            }
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO reputation_scores (
        tenant_id,
        entity_type,
        entity_id,
        entity_global_user_id,
        global_score,
        rating_count,
        last_rating_at,
        quality_score,
        punctuality_score,
        professionalism_score,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,now())
      ON CONFLICT (tenant_id, entity_type, entity_id)
      DO UPDATE SET
        entity_global_user_id = COALESCE(EXCLUDED.entity_global_user_id, reputation_scores.entity_global_user_id),
        global_score = EXCLUDED.global_score,
        rating_count = EXCLUDED.rating_count,
        last_rating_at = EXCLUDED.last_rating_at,
        quality_score = EXCLUDED.quality_score,
        punctuality_score = EXCLUDED.punctuality_score,
        professionalism_score = EXCLUDED.professionalism_score,
        updated_at = now()
      RETURNING tenant_id, entity_type, entity_id, entity_global_user_id, global_score, rating_count, last_rating_at, quality_score, punctuality_score, professionalism_score, updated_at
      `, [
            tenantId,
            payload.entityType,
            payload.entityId,
            entityGlobalUserId,
            newGlobal,
            newCount,
            newQuality,
            newPunctuality,
            newProfessionalism,
        ]);
        if (!row) {
            throw new Error('Failed to upsert reputation score');
        }
        return this.toScore(row);
    }
}
exports.reputationService = new ReputationService();
//# sourceMappingURL=reputation.service.js.map