// src/core/unifybank/unifybank.module.ts
// Módulo UnifyBank - Sistema de moeda fictícia de teste e transferências P2P

import { FastifyPluginAsync } from 'fastify';
import testCurrencyRoutes from './test-currency.routes';
import bankP2PTransferRoutes from './bank-p2p-transfer.routes';
import donationRoutes from './donation.routes';
import transparencyRoutes from './transparency.routes';
import transparencyAdminRoutes from './transparency-admin.routes';
import governanceRoutes from './regional-fund-governance.routes';

const unifybankModule: FastifyPluginAsync = async (fastify) => {
  // Rotas administrativas de moeda de teste (registradas em /admin/test-currency)
  await fastify.register(testCurrencyRoutes, { prefix: '/test-currency' });
  
  // Rotas de transferência P2P (registradas em /bank/p2p-transfer quando prefix=/bank)
  // ou em /admin/bank/p2p-transfer quando prefix=/admin
  await fastify.register(bankP2PTransferRoutes);
  
  // Rotas de doação (registradas em /bank/donate quando prefix=/bank)
  await fastify.register(donationRoutes);
  
  // Rotas de transparência financeira (registradas em /bank quando prefix=/bank)
  // FASE 6: Transparência Financeira
  await fastify.register(transparencyRoutes);
  
  // Rotas admin de transparência financeira (registradas em /admin/bank quando prefix=/admin)
  // FASE 6: Transparência Financeira - Admin
  await fastify.register(transparencyAdminRoutes);
  
  // Rotas de governança do fundo regional (registradas em /regional-fund quando prefix=/bank)
  // FASE 8: Governança do Fundo Regional
  await fastify.register(governanceRoutes, { prefix: '/regional-fund' });
};

export default unifybankModule;















