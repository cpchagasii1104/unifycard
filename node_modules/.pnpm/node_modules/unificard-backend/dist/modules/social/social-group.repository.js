"use strict";
// src/modules/social/social-group.repository.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialGroupRepository = void 0;
const pool_1 = require("@core/database/pool");
const groups_repository_1 = require("../groups/groups.repository");
const account_service_1 = require("@core/economy/accounts/account.service");
class SocialGroupRepository {
    /**
     * Busca informações sociais de um grupo
     */
    async getGroupSocialInfo(tenantId, groupId) {
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            return null;
        }
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const memberCount = members.length;
        // Buscar total recebido (saldo da conta)
        let totalReceived = 0;
        const groupAccount = await groups_repository_1.groupsRepository.getGroupAccount(tenantId, groupId);
        if (groupAccount) {
            const account = await account_service_1.accountService.getAccountById(tenantId, groupAccount.accountId);
            if (account) {
                totalReceived = account.balance;
            }
        }
        // Contar posts recentes (últimos 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentPostsCount = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND created_at >= $3
      `, [tenantId, groupId, thirtyDaysAgo]);
        const recentPosts = recentPostsCount ? Number(recentPostsCount.count) : 0;
        // Calcular indicadores básicos
        const indicators = {
            activeMembers: memberCount, // TODO: Calcular membros ativos (com posts recentes)
            avgPostPerMember: memberCount > 0 ? recentPosts / memberCount : 0,
        };
        return {
            groupId,
            name: group.name,
            description: group.description,
            memberCount,
            totalReceived,
            recentPosts,
            indicators,
        };
    }
    /**
     * Busca feed de posts de um grupo
     */
    async getGroupFeed(tenantId, groupId, options = {}) {
        const { limit = 50, offset = 0, includeAutoPosts = true } = options;
        let query = `
      SELECT post_id, tenant_id, global_user_id, content, media, intent, confidence, categories, suggested_actions, metadata, created_at, updated_at
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
    `;
        const params = [tenantId, groupId];
        // Se não incluir auto-posts, filtrar por tipo
        if (!includeAutoPosts) {
            query += ` AND metadata->>'type' != 'system_auto_post'`;
        }
        query += ` ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
        params.push(limit, offset);
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        // Contar total
        let countQuery = `
      SELECT COUNT(*) as total
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
    `;
        const countParams = [tenantId, groupId];
        if (!includeAutoPosts) {
            countQuery += ` AND metadata->>'type' != 'system_auto_post'`;
        }
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, countQuery, countParams);
        return {
            rows,
            total: countRow ? Number(countRow.total) : 0,
        };
    }
    /**
     * Busca insights de um grupo
     */
    async getGroupInsights(tenantId, groupId) {
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            return null;
        }
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const memberCount = members.length;
        // Buscar total recebido
        let totalReceived = 0;
        const groupAccount = await groups_repository_1.groupsRepository.getGroupAccount(tenantId, groupId);
        if (groupAccount) {
            const account = await account_service_1.accountService.getAccountById(tenantId, groupAccount.accountId);
            if (account) {
                totalReceived = account.balance;
            }
        }
        // Buscar últimos 20 auto-posts econômicos
        const autoPosts = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT post_id, content, metadata, created_at
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'type' = 'system_auto_post'
        AND metadata->>'source' = 'economic_impact'
      ORDER BY created_at DESC
      LIMIT 20
      `, [tenantId, groupId]);
        const recentAutoPosts = autoPosts.map((p) => ({
            postId: p.post_id,
            content: p.content,
            amount: p.metadata?.splitAmount || 0,
            createdAt: p.created_at,
            assignmentId: p.metadata?.assignmentId,
            jobId: p.metadata?.jobId,
        }));
        // Calcular crescimento mensal (últimos 6 meses)
        const monthlyGrowth = await this.calculateMonthlyGrowth(tenantId, groupId);
        // Buscar membro mais ativo (por posts)
        const mostActive = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT global_user_id, COUNT(*) as post_count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY global_user_id
      ORDER BY post_count DESC
      LIMIT 1
      `, [tenantId, groupId]);
        // Buscar atividades mais frequentes
        const frequentActivities = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT metadata->>'activity' as activity, COUNT(*) as count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'activity' IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY metadata->>'activity'
      ORDER BY count DESC
      LIMIT 5
      `, [tenantId, groupId]);
        return {
            groupId,
            name: group.name,
            totalReceived,
            recentAutoPosts,
            monthlyGrowth,
            memberCount,
            mostActiveMember: mostActive
                ? {
                    userId: mostActive.global_user_id,
                    postCount: Number(mostActive.post_count),
                }
                : undefined,
            frequentActivities: frequentActivities.map((a) => ({
                activity: a.activity || 'unknown',
                count: Number(a.count),
            })),
        };
    }
    /**
     * Calcula crescimento mensal de recebimentos
     */
    async calculateMonthlyGrowth(tenantId, groupId) {
        const growth = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM((metadata->>'splitAmount')::numeric) as amount
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'type' = 'system_auto_post'
        AND metadata->>'source' = 'economic_impact'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
      `, [tenantId, groupId]);
        return growth.map((g) => ({
            month: g.month,
            amount: Number(g.amount || 0),
        }));
    }
    /**
     * Busca feed de impacto combinado
     */
    async getImpactFeed(tenantId, userId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        // Buscar grupos do usuário
        const userGroups = await groups_repository_1.groupsRepository.getUserGroups(tenantId, userId);
        const groupIds = userGroups.map((g) => g.groupId);
        if (groupIds.length === 0) {
            return { items: [], total: 0 };
        }
        // Buscar posts de grupos + auto-posts econômicos
        const query = `
      SELECT post_id, global_user_id, content, metadata, created_at
      FROM posts
      WHERE tenant_id = $1
        AND (
          metadata->>'groupId' = ANY($2::text[])
          OR (metadata->>'source' = 'economic_impact' AND metadata->>'groupId' = ANY($2::text[]))
        )
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, [
            tenantId,
            groupIds,
            limit,
            offset,
        ]);
        // Contar total
        const countQuery = `
      SELECT COUNT(*) as total
      FROM posts
      WHERE tenant_id = $1
        AND (
          metadata->>'groupId' = ANY($2::text[])
          OR (metadata->>'source' = 'economic_impact' AND metadata->>'groupId' = ANY($2::text[]))
        )
    `;
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, countQuery, [tenantId, groupIds]);
        return {
            items: rows,
            total: countRow ? Number(countRow.total) : 0,
        };
    }
}
exports.socialGroupRepository = new SocialGroupRepository();
//# sourceMappingURL=social-group.repository.js.map