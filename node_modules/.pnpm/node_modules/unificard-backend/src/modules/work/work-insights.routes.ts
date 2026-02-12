// src/modules/work/work-insights.routes.ts
//
// Rotas de insights do módulo Work
// Endpoints para acessar análises inteligentes baseadas em Memory Engine

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { rbacService } from '@core/rbac/rbac.service';
import { workInsightsService } from './work-insights.service';

const workInsightsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper para validar acesso aos insights
   * - Usuário pode ver seus próprios insights
   * - OWNER ou ADMIN pode ver insights de qualquer usuário
   */
  async function validateInsightsAccess(req: FastifyRequest, targetUserId?: string): Promise<void> {
    const tenantId = req.tenant!.id;
    const currentUserId = req.user!.id;
    const userIdToCheck = targetUserId || currentUserId;

    // Se for o próprio usuário, permitir
    if (userIdToCheck === currentUserId) {
      return;
    }

    // Verificar se é OWNER ou ADMIN usando RBAC
    const hasAdminRole = await rbacService.userHasAnyRole(tenantId, currentUserId, ['admin', 'owner']);
    
    if (!hasAdminRole) {
      throw fastify.httpErrors.forbidden('You can only view your own insights. Admin or Owner role required to view other users\' insights.');
    }
  }

  /**
   * GET /work/insights/summary
   * Retorna resumo das últimas sessões de trabalho do usuário
   */
  fastify.get<{ Querystring: { limit?: number; userId?: string } }>(
    '/summary',
    {
      preHandler: fastify.requirePermission(['work:insights:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const targetUserId = (req.query.userId as string) || req.user!.id;
      
      // Validar acesso
      await validateInsightsAccess(req, targetUserId);
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 5;

      const summaries = await workInsightsService.getSummary(tenantId, targetUserId, limit);

      return {
        userId: targetUserId,
        summaries,
        count: summaries.length,
      };
    }
  );

  /**
   * GET /work/insights/history
   * Retorna histórico dos últimos jobs do usuário
   */
  fastify.get<{ Querystring: { limit?: number; userId?: string } }>(
    '/history',
    {
      preHandler: fastify.requirePermission(['work:insights:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const targetUserId = (req.query.userId as string) || req.user!.id;
      
      // Validar acesso
      await validateInsightsAccess(req, targetUserId);
      
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;

      const history = await workInsightsService.getHistory(tenantId, targetUserId, limit);

      return {
        userId: targetUserId,
        history,
        count: history.length,
      };
    }
  );

  /**
   * GET /work/insights/performance
   * Retorna score de performance do usuário
   */
  fastify.get<{ Querystring: { userId?: string } }>(
    '/performance',
    {
      preHandler: fastify.requirePermission(['work:insights:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const targetUserId = (req.query.userId as string) || req.user!.id;
      
      // Validar acesso
      await validateInsightsAccess(req, targetUserId);

      const performance = await workInsightsService.getPerformance(tenantId, targetUserId);

      return {
        userId: targetUserId,
        performance,
      };
    }
  );

  /**
   * GET /work/insights/patterns
   * Retorna padrões detectados do trabalho do usuário
   */
  fastify.get<{ Querystring: { userId?: string } }>(
    '/patterns',
    {
      preHandler: fastify.requirePermission(['work:insights:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const targetUserId = (req.query.userId as string) || req.user!.id;
      
      // Validar acesso
      await validateInsightsAccess(req, targetUserId);

      const patterns = await workInsightsService.getPatterns(tenantId, targetUserId);

      return {
        userId: targetUserId,
        patterns,
      };
    }
  );
};

export default workInsightsRoutes;

