"use strict";
// backend/src/core/unifybank/regional-fund-governance-rate-limit.service.ts
// Rate Limiting para Governança do Fundo Regional - FASE 8
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionalFundGovernanceRateLimitService = void 0;
const pool_1 = require("@core/database/pool");
class RegionalFundGovernanceRateLimitService {
    MAX_PROPOSALS_PER_MONTH = 3;
    MAX_VOTES_PER_MINUTE = 10;
    /**
     * Verifica rate limit para criar proposta (3/mês)
     */
    async checkProposalRateLimit(tenantId, globalUserId) {
        const now = new Date();
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const result = await pool_1.pool.query(`
      SELECT COUNT(*)::text as count
      FROM regional_fund_proposals
      WHERE tenant_id = $1
        AND created_by = $2
        AND created_at >= $3
      `, [tenantId, globalUserId, oneMonthAgo]);
        const currentCount = parseInt(result.rows[0]?.count || '0', 10);
        const allowed = currentCount < this.MAX_PROPOSALS_PER_MONTH;
        // Calcular reset (próximo mês)
        const resetAt = new Date(now);
        resetAt.setMonth(resetAt.getMonth() + 1);
        resetAt.setDate(1);
        resetAt.setHours(0, 0, 0, 0);
        return {
            allowed,
            currentCount,
            maxCount: this.MAX_PROPOSALS_PER_MONTH,
            resetAt,
        };
    }
    /**
     * Verifica rate limit para votar (10/min)
     */
    async checkVoteRateLimit(tenantId, globalUserId) {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const result = await pool_1.pool.query(`
      SELECT COUNT(*)::text as count
      FROM regional_fund_votes
      WHERE global_user_id = $1
        AND created_at >= $2
        AND EXISTS (
          SELECT 1 FROM regional_fund_proposals p
          WHERE p.proposal_id = regional_fund_votes.proposal_id
            AND p.tenant_id = $3
        )
      `, [globalUserId, oneMinuteAgo, tenantId]);
        const currentCount = parseInt(result.rows[0]?.count || '0', 10);
        const allowed = currentCount < this.MAX_VOTES_PER_MINUTE;
        // Reset em 1 minuto
        const resetAt = new Date(now.getTime() + 60 * 1000);
        return {
            allowed,
            currentCount,
            maxCount: this.MAX_VOTES_PER_MINUTE,
            resetAt,
        };
    }
}
exports.regionalFundGovernanceRateLimitService = new RegionalFundGovernanceRateLimitService();
