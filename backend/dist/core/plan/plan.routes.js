"use strict";
// src/core/plan/plan.routes.ts
// Rotas para gerenciar plano do usuário
// FASE 3.6: Toggle FREE/PRO para usuário teste
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("@core/database/pool");
const plan_gate_service_1 = require("./plan-gate.service");
const planRoutes = async (fastify) => {
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
            const userId = req.user.userId;
            if (!userId) {
                return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
            }
            const plan = await plan_gate_service_1.planGateService.getUserPlan(req.tenant.id, userId);
            // Buscar também is_test para verificar se pode alternar
            const userRow = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          SELECT u.is_test,
                 (SELECT r.name FROM roles r
                  JOIN user_roles ur ON r.role_id = ur.role_id
                  WHERE ur.user_id = u.user_id AND ur.tenant_id = u.tenant_id
                  LIMIT 1) as role
          FROM users u
          WHERE u.user_id = $1
          LIMIT 1
        `, [userId]);
            const isTest = userRow?.is_test || false;
            const isAdmin = userRow?.role === 'admin';
            return reply.send({
                ok: true,
                data: {
                    plan,
                    canToggle: isTest || isAdmin, // Usuário teste ou admin pode alternar
                },
            });
        }
        catch (error) {
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
    fastify.put('/', async (req, reply) => {
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
            const userId = req.user.userId;
            if (!userId) {
                return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
            }
            // Verificar se usuário pode alternar (teste ou admin)
            const userRow = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          SELECT u.is_test,
                 (SELECT r.name FROM roles r
                  JOIN user_roles ur ON r.role_id = ur.role_id
                  WHERE ur.user_id = u.user_id AND ur.tenant_id = u.tenant_id
                  LIMIT 1) as role
          FROM users u
          WHERE u.user_id = $1
          LIMIT 1
        `, [userId]);
            const isTest = userRow?.is_test || false;
            const isAdmin = userRow?.role === 'admin';
            if (!isTest && !isAdmin) {
                return reply.status(403).send({
                    ok: false,
                    message: 'Apenas usuários de teste ou administradores podem alternar plano',
                });
            }
            // Atualizar plano
            await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          UPDATE users
          SET plan = $1, updated_at = now()
          WHERE user_id = $2
        `, [plan, userId]);
            return reply.send({
                ok: true,
                data: {
                    plan,
                    canToggle: true, // Se chegou aqui, pode alternar
                },
                message: `Plano atualizado para ${plan}`,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar plano');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao atualizar plano',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
};
exports.default = planRoutes;
