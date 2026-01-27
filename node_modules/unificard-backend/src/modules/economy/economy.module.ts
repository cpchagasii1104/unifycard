// src/modules/economy/economy.module.ts
// Módulo do Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
// 🔴 BLINDAGEM: Ele apenas EXIBE o que já aconteceu

import { FastifyPluginAsync } from 'fastify';
import economicOverviewRoutes from './economic-overview.routes';

const economyModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(economicOverviewRoutes);
};

export default economyModule;
export const economyOverviewModule = economyModule;

