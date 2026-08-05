// src/modules/groups/groups.insights.routes.ts

import { FastifyPluginAsync } from 'fastify';
import { groupsService } from './groups.service';
import { groupsInsightsService } from './groups.insights.service';
import { grupoLegivelPor } from './group-readability';

const groupsInsightsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /groups/insights/my-groups
   * Insights dos grupos do usuário
   */
  fastify.get(
    '/my-groups',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;

      const groups = await groupsService.getUserGroups(tenantId, userId);
      const insights = await Promise.all(
        groups.map((group) => groupsInsightsService.getGroupInsights(tenantId, group.groupId))
      );

      return { groups: insights };
    }
  );

  /**
   * GET /groups/insights/:groupId
   * Insights de um grupo específico
   */
  fastify.get<{ Params: { groupId: string } }>(
    '/:groupId',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { groupId } = req.params;

      const group = await groupsService.getGroup(tenantId, groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // 🔒 LEGIBILIDADE DO GRUPO — mesma regra dos irmãos (achado 3 da YALA). Esta rota já buscava
      // o grupo e já respondia 404 quando não existia; faltava a metade que decide se **este**
      // usuário pode vê-lo. Insight de grupo secreto era legível por qualquer autenticado com o id.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      if (!(await grupoLegivelPor(tenantId, req.user.userId, groupId, group.visibility))) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const insights = await groupsInsightsService.getGroupInsights(tenantId, groupId);
      return insights;
    }
  );
};

export default groupsInsightsRoutes;
















