"use strict";
// src/modules/social/social-group-insights.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const groups_service_1 = require("../groups/groups.service");
const pool_1 = require("@core/database/pool");
const socialGroupInsightsRoutes = async (fastify) => {
    /**
     * GET /social/impact/ai-summary
     * Resumo AI do feed de impacto
     */
    fastify.get('/impact/ai-summary', {
        preHandler: fastify.requirePermission(['social:impact:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const globalUserId = req.user.globalUserId || req.user.id;
        // 1. Buscar grupos do usuário
        const userGroups = await groups_service_1.groupsService.getUserGroups(tenantId, globalUserId);
        // 2. Buscar auto-posts econômicos recentes
        const groupIds = userGroups.map((g) => g.groupId);
        let recentAutoPosts = [];
        if (groupIds.length > 0) {
            const posts = await (0, pool_1.runQueriesWithTenant)(tenantId, `
          SELECT post_id, content, metadata, created_at
          FROM posts
          WHERE tenant_id = $1
            AND metadata->>'groupId' = ANY($2::text[])
            AND metadata->>'type' = 'system_auto_post'
            AND metadata->>'source' = 'economic_impact'
            AND created_at >= NOW() - INTERVAL '30 days'
          ORDER BY created_at DESC
          LIMIT 20
          `, [tenantId, groupIds]);
            recentAutoPosts = posts || [];
        }
        // 3. Buscar histórico recente de splits
        let totalImpact = 0;
        for (const post of recentAutoPosts) {
            totalImpact += post.metadata?.splitAmount || 0;
        }
        // 4. Gerar resumo via AI Kernel
        let summary = '';
        let suggestions = [];
        try {
            const aiKernel = fastify.ai;
            if (aiKernel) {
                const prompt = `Gere um resumo do impacto social do usuário baseado nos seguintes dados:
- Grupos: ${userGroups.length}
- Total recebido pelos grupos: R$ ${totalImpact.toFixed(2)}
- Posts econômicos recentes: ${recentAutoPosts.length}

Gere um resumo curto e sugestões de ações.`;
                const aiResult = await aiKernel.run(prompt, {
                    userId: globalUserId,
                    tenantId,
                    task: 'social_impact_summary',
                });
                summary = aiResult.result || aiResult.output || '';
                suggestions = aiResult.suggestions || [];
            }
            else {
                // Fallback se AI Kernel não disponível
                summary = `Você está em ${userGroups.length} grupos que receberam R$ ${totalImpact.toFixed(2)} nos últimos 30 dias através de ${recentAutoPosts.length} atividades.`;
                suggestions = [
                    'Continue participando ativamente dos seus grupos',
                    'Compartilhe suas conquistas com a comunidade',
                ];
            }
        }
        catch (error) {
            console.error('Error generating AI summary:', error);
            summary = `Você está em ${userGroups.length} grupos que receberam R$ ${totalImpact.toFixed(2)} nos últimos 30 dias.`;
            suggestions = [];
        }
        return {
            summary,
            suggestions,
            metrics: {
                totalImpact,
                groupsCount: userGroups.length,
                recentActivity: recentAutoPosts.length,
            },
        };
    });
};
exports.default = socialGroupInsightsRoutes;
