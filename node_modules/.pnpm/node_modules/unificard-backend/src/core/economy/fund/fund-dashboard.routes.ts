// src/core/economy/fund/fund-dashboard.routes.ts
// Rotas para dashboard detalhado do Fundo Regional

import { FastifyPluginAsync } from 'fastify';
import { fundDashboardService } from './fund-dashboard.service';

interface DashboardQuery {
  days?: string; // número de dias (ex: "30", "90", "365")
}

const fundDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /fund/dashboard
   * Retorna dados completos do dashboard do Fundo Regional
   * Inclui: receitas por módulo, custos operacionais, estatísticas
   */
  fastify.get<{ Querystring: DashboardQuery }>('/dashboard', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { days = '30' } = req.query;

    // Parse days (ex: "30" -> 30)
    const rangeDays = parseInt(days, 10) || 30;
    // Limitar a 365 dias para evitar queries muito pesadas
    const safeRangeDays = Math.min(Math.max(7, rangeDays), 365);

    try {
      const dashboardData = await fundDashboardService.getDashboardData(
        tenantId,
        safeRangeDays
      );
      return reply.send(dashboardData);
    } catch (error: any) {
      const errorMessage = error?.message || error?.originalError?.message || 'Erro desconhecido';
      const errorStack = error?.stack || error?.originalError?.stack;
      
      fastify.log.error({ 
        err: error, 
        tenantId,
        stack: errorStack,
        message: errorMessage,
        originalError: error?.originalError
      }, 'Erro ao buscar dados do dashboard');
      
      return reply.status(500).send({
        error: 'Erro ao buscar dados do dashboard do Fundo Regional',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && errorStack ? { 
          stack: errorStack,
          details: error?.originalError 
        } : {}),
      });
    }
  });
};

export default fundDashboardRoutes;

