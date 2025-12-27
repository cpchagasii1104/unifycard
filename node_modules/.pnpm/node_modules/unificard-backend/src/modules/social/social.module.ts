// src/modules/social/social.module.ts
import { FastifyPluginAsync } from 'fastify';
import socialRoutes from './social.routes';
import social2Routes from './social-2.0.routes';
import socialWorkRoutes from './social-work.routes';
import socialWorkApplyRoutes from './social-work-apply.routes';
import socialWorkScheduleRoutes from './social-work-schedule.routes';
import socialWorkPaymentRoutes from './social-work-payment.routes';
import socialGroupRoutes from './social-group.routes';
import socialGroupInsightsRoutes from './social-group-insights.routes';
import intentOrchestratorRoutes from './intent-orchestrator.routes';

const socialModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(socialRoutes);
  await fastify.register(social2Routes); // Social 2.0 routes (já inclui ledger)
  await fastify.register(socialWorkRoutes, { prefix: '/work' });
  await fastify.register(socialWorkApplyRoutes, { prefix: '/work' });
  await fastify.register(socialWorkScheduleRoutes, { prefix: '/work' });
  await fastify.register(socialWorkPaymentRoutes, { prefix: '/work' });
  await fastify.register(socialGroupRoutes);
  await fastify.register(socialGroupInsightsRoutes);
  await fastify.register(intentOrchestratorRoutes);
};

export default socialModule;

