// src/modules/social/social-group-insights.routes.ts

import { FastifyPluginAsync } from 'fastify';
import { socialGroupService } from './social-group.service';
import { socialGroupRepository } from './social-group.repository';
import { groupsService } from '../groups/groups.service';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

const socialGroupInsightsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /social/impact/ai-summary
   * Resumo AI do feed de impacto
   */
  fastify.get(
    '/impact/ai-summary',
    {
      preHandler: fastify.requirePermission(['social:impact:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const globalUserId = req.user!.globalUserId || req.user!.id;

      // 1. Buscar grupos do usuário
      const userGroups = await groupsService.getUserGroups(tenantId, globalUserId);

      // 2. Buscar auto-posts econômicos recentes
      const groupIds = userGroups.map((g: any) => g.groupId);
      let recentAutoPosts: any[] = [];

      if (groupIds.length > 0) {
        const posts = await runQueriesWithTenant<{
          post_id: string;
          content: string;
          metadata: any;
          createdAt: Date;
        }>(
          tenantId,
          `
          SELECT post_id, content, metadata, createdAt
          FROM posts
          WHERE tenant_id = $1
            AND metadata->>'groupId' = ANY($2::text[])
            AND metadata->>'type' = 'system_auto_post'
            AND metadata->>'source' = 'economic_impact'
            AND createdAt >= NOW() - INTERVAL '30 days'
          ORDER BY createdAt DESC
          LIMIT 20
          `,
          [tenantId, groupIds]
        );
        recentAutoPosts = posts || [];
      }

      // 3. Buscar histórico recente de splits
      let totalImpact = 0;
      for (const post of recentAutoPosts) {
        totalImpact += post.metadata?.splitAmount || 0;
      }

      // 4. Gerar resumo via AI Kernel
      let summary = '';
      let suggestions: string[] = [];

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

          summary = (aiResult as any).result || (aiResult as any).output || '';
          suggestions = (aiResult as any).suggestions || [];
        } else {
          // Fallback se AI Kernel não disponível
          summary = `Você está em ${userGroups.length} grupos que receberam R$ ${totalImpact.toFixed(2)} nos últimos 30 dias através de ${recentAutoPosts.length} atividades.`;
          suggestions = [
            'Continue participando ativamente dos seus grupos',
            'Compartilhe suas conquistas com a comunidade',
          ];
        }
      } catch (error) {
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
    }
  );
};

export default socialGroupInsightsRoutes;


