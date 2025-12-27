// src/core/plan/plan.routes.ts
// Rotas para gerenciar plano do usuário
// FASE 3.6: Toggle FREE/PRO para usuário teste

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant } from '@core/database/pool';
import { planGateService, type UserPlan } from './plan-gate.service';

const planRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /plan
   * Retorna o plano atual do usuário
   */
  fastify.get('/', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const plan = await planGateService.getUserPlan(req.tenant.id, req.user.id || req.user.globalUserId || '');
      
      // Buscar também is_test para verificar se pode alternar
      const userRow = await runQueryWithTenant<{ is_test: boolean | null; role: string | null }>(
        req.tenant.id,
        `
          SELECT u.is_test,
                 (SELECT r.name FROM roles r
                  JOIN user_roles ur ON r.role_id = ur.role_id
                  WHERE ur.user_id = u.user_id AND ur.tenant_id = u.tenant_id
                  LIMIT 1) as role
          FROM users u
          WHERE u.user_id = $1
          LIMIT 1
        `,
        [req.user.id]
      );

      const isTest = userRow?.is_test || false;
      const isAdmin = userRow?.role === 'admin';

      return reply.send({
        ok: true,
        data: {
          plan,
          canToggle: isTest || isAdmin, // Usuário teste ou admin pode alternar
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar plano');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar plano',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /plan
   * Atualiza o plano do usuário
   * FASE 3.6: Apenas usuário teste ou admin pode alternar
   */
  fastify.put<{
    Body: {
      plan: UserPlan;
    };
  }>('/', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const { plan } = req.body;

      // Validar plano
      if (plan !== 'free' && plan !== 'pro' && plan !== 'enterprise') {
        return reply.status(400).send({
          ok: false,
          message: 'Plano inválido. Deve ser: free, pro ou enterprise',
        });
      }

      // Verificar se usuário pode alternar (teste ou admin)
      const userRow = await runQueryWithTenant<{ is_test: boolean | null; role: string | null }>(
        req.tenant.id,
        `
          SELECT u.is_test,
                 (SELECT r.name FROM roles r
                  JOIN user_roles ur ON r.role_id = ur.role_id
                  WHERE ur.user_id = u.user_id AND ur.tenant_id = u.tenant_id
                  LIMIT 1) as role
          FROM users u
          WHERE u.user_id = $1
          LIMIT 1
        `,
        [req.user.id]
      );

      const isTest = userRow?.is_test || false;
      const isAdmin = userRow?.role === 'admin';

      if (!isTest && !isAdmin) {
        return reply.status(403).send({
          ok: false,
          message: 'Apenas usuários de teste ou administradores podem alternar plano',
        });
      }

      // Atualizar plano
      await runQueryWithTenant(
        req.tenant.id,
        `
          UPDATE users
          SET plan = $1, updated_at = now()
          WHERE user_id = $2
        `,
        [plan, req.user.id]
      );

      return reply.send({
        ok: true,
        data: {
          plan,
          canToggle: true, // Se chegou aqui, pode alternar
        },
        message: `Plano atualizado para ${plan}`,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao atualizar plano');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao atualizar plano',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default planRoutes;
