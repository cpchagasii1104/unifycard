// src/core/unifybank/unifybank.module.ts
// Módulo UnifyBank - Sistema de moeda fictícia de teste e transferências P2P

import { FastifyPluginAsync } from 'fastify';
import testCurrencyRoutes from './test-currency.routes';
// 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1B (Opção A · DECISION-0165): rotas p2p-transfer e
//    donation DESMONTADAS (não registradas). Ambas movem dinheiro pelo seam legado transferP2P /
//    context 'p2p_transfer' (fora do MVP). Arquivos e schema preservados; donation = HOLD para
//    futura migração ao pipeline canônico. Imports removidos por ficarem órfãos após o unmount.
import bankHttpRoutes from './bank-http.routes';
import transparencyRoutes from './transparency.routes';
import userGroupAllocationRoutes from '../user-group-allocation/user-group-allocation.routes';
import bankMetricsRoutes from '../observability/bank-metrics.routes';
import handlerMetricsRoutes from '../observability/handler-metrics.routes';
import outboxMetricsRoutes from '../events/outbox-metrics.routes';
import reconciliationMetricsRoutes from '../reconciliation/reconciliation-metrics.routes';
import sagaMetricsRoutes from '../sagas/saga-metrics.routes';
import transparencyAdminRoutes from './transparency-admin.routes';
import governanceRoutes from './regional-fund-governance.routes';
import bankBalanceConsolidationRoutes from './bank-balance-consolidation.routes';

const unifybankModule: FastifyPluginAsync = async (fastify) => {
  // Rotas administrativas de moeda de teste (registradas em /admin/test-currency)
  await fastify.register(testCurrencyRoutes, { prefix: '/test-currency' });
  
  // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1B (Opção A · DECISION-0165 D5/D8): rotas
  //    p2p-transfer e donation DESMONTADAS. Movem dinheiro pelo seam legado transferP2P /
  //    context 'p2p_transfer' (split fora do Bank), fora do MVP. Reabrir p2p/donation = frente
  //    própria com GO + pipeline canônico. Nada de dado/schema tocado; donation = HOLD.
  // await fastify.register(bankP2PTransferRoutes);  // desmontada (Fase 1B)
  // await fastify.register(donationRoutes);         // desmontada (Fase 1B, donation = HOLD)

  // HTTP canónico do Bank (saldo + transações) — §4.7, prefix /bank
  await fastify.register(bankHttpRoutes);

  // Rotas de transparência financeira (registradas em /bank quando prefix=/bank)
  // FASE 6: Transparência Financeira
  await fastify.register(transparencyRoutes);
  
  // Rotas admin de transparência financeira (registradas em /admin/bank quando prefix=/admin)
  // FASE 6: Transparência Financeira - Admin
  await fastify.register(transparencyAdminRoutes);
  
  // Rotas de governança do fundo regional (registradas em /regional-fund quando prefix=/bank)
  // FASE 8: Governança do Fundo Regional
  await fastify.register(governanceRoutes, { prefix: '/regional-fund' });
  
  // Rotas de alocação de grupos (registradas em /user/group-allocation quando prefix=/bank)
  // CONTINUOUS PRODUCTION: Group Allocation
  await fastify.register(userGroupAllocationRoutes, { prefix: '/user' });
  
  // Rotas de métricas (registradas em /admin/metrics quando prefix=/admin)
  // CONTINUOUS PRODUCTION: Observabilidade mínima
  await fastify.register(bankMetricsRoutes, { prefix: '/metrics' });
  await fastify.register(handlerMetricsRoutes, { prefix: '/metrics/handlers' });
  await fastify.register(outboxMetricsRoutes, { prefix: '/metrics/outbox' });
  await fastify.register(reconciliationMetricsRoutes, { prefix: '/metrics/reconciliation' });
  await fastify.register(sagaMetricsRoutes, { prefix: '/metrics/sagas' });
  
  // Rotas de balanço consolidado (registradas em /admin/finance quando prefix=/admin)
  // READ-MODEL: Balanço Financeiro Consolidado
  await fastify.register(bankBalanceConsolidationRoutes, { prefix: '/finance' });
};

export default unifybankModule;
export { unifybankModule };




























