// src/modules/economy/economy.module.ts
// Módulo do Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
// 🔴 BLINDAGEM: Ele apenas EXIBE o que já aconteceu

import { FastifyPluginAsync } from 'fastify';
import economicOverviewRoutes from './economic-overview.routes';
// F-ECONOMIC-POLICY-ADMIN-FRONT Fatia 1 (authority key + read-only consumer) — READ-ONLY,
// gate admin real (requireRole) + prova da PermissionKey (requirePermission). Ver
// policy-engine/economic-policy-admin.routes.ts para a fronteira DECISION-0166 D6.
import economicPolicyAdminRoutes from './policy-engine/economic-policy-admin.routes';

const economyModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(economicOverviewRoutes);
  await fastify.register(economicPolicyAdminRoutes);
};

export default economyModule;
export const economyOverviewModule = economyModule;

