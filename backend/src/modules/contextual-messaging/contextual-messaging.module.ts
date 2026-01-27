// backend/src/modules/contextual-messaging/contextual-messaging.module.ts
// Módulo de Mensageria Contextual

import { FastifyPluginAsync } from 'fastify';
import contextualThreadRoutes from './contextual-thread.routes';

const contextualMessagingModule: FastifyPluginAsync = async (fastify) => {
  // Feature flag: Messaging
  const { isMessagingEnabled } = await import('@core/features/feature-flags');
  if (isMessagingEnabled()) {
    await fastify.register(contextualThreadRoutes);
  } else {
    fastify.log.warn('[ContextualMessagingModule] Messaging feature está desabilitada (FEATURE_MESSAGING_ENABLED=false)');
  }
};

export default contextualMessagingModule;

