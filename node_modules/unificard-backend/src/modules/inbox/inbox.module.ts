// src/modules/inbox/inbox.module.ts
// Módulo do Domínio de INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
// 🔴 BLINDAGEM: Inbox NÃO decide nada, apenas ORGANIZA

import { FastifyPluginAsync } from 'fastify';
import { socialInboxRoutes } from './social-inbox.routes';

export const inboxModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(socialInboxRoutes);
};

