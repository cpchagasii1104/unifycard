// src/modules/services/services.module.ts
// Módulo do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Registra ServicesFeedPlugin no FeedPluginRegistry

import { FastifyPluginAsync } from 'fastify';
import servicesRoutes from './services.routes';
import serviceBookingDecisionRoutes from './service-booking-decision.routes';
import servicePaymentRequestRoutes from './service-payment-request.routes';
import servicePaymentExecutionRoutes from './service-payment-execution.routes';
import serviceOrderRoutes from './service-order.routes'; // SPRINT 68
import serviceBundleRoutes from './service-bundle.routes';
import { feedPluginService } from '@core/feed/feed-plugin.service';
import { servicesFeedPlugin } from './service-feed.plugin';

const servicesModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(servicesRoutes);
  // 🔴 CORREÇÃO FASE 1: Removidas rotas de service-availability, service-booking e calendar
  // Toda lógica temporal agora usa Unified Availability
  await fastify.register(serviceBookingDecisionRoutes);
  await fastify.register(servicePaymentRequestRoutes);
  await fastify.register(servicePaymentExecutionRoutes, { prefix: '/payments' });
  // SPRINT 68: Service Orders
  await fastify.register(serviceOrderRoutes);
  // Service Bundles (co-agendamento)
  // Feature flag: Bundles
  const { isBundlesEnabled } = await import('@core/features/feature-flags');
  if (isBundlesEnabled()) {
    await fastify.register(serviceBundleRoutes);
  } else {
    fastify.log.warn('[ServicesModule] Bundles feature está desabilitada (FEATURE_BUNDLES_ENABLED=false)');
  }
  
  // 🔴 BLINDAGEM: Registrar ServicesFeedPlugin no FeedPluginRegistry
  // Plugin apenas renderiza dados, não executa ações
  // Feed não decide comportamento, apenas orquestra visualmente
  // Booking é domínio, não feed
  try {
    feedPluginService.registerPlugin(servicesFeedPlugin);
    console.log('[BOOT] ServicesFeedPlugin registrado no FeedPluginRegistry');
  } catch (error) {
    console.error('[BOOT] Erro ao registrar ServicesFeedPlugin:', error);
    // Não quebra o módulo se registro falhar
  }
};

export default servicesModule;
export { servicesModule };

