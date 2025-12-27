// src/modules/social-chat/social-chat.module.ts
import { FastifyPluginAsync } from 'fastify';
import socialChatRoutes from './social-chat.routes';

const socialChatModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(socialChatRoutes);
};

export default socialChatModule;








