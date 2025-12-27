// src/core/referral/referral.routes.ts
// Rotas de código de indicação/afiliado

import { FastifyPluginAsync } from 'fastify';
import { referralService } from './referral.service';

const referralRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /referral/code
   * Obtém ou gera código de indicação do usuário autenticado
   */
  fastify.get('/code', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const code = await referralService.getOrCreateReferralCode(req.tenant.id, req.user.id);
      return { referralCode: code };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar código de indicação');
      return reply.status(500).send({ error: 'Erro ao buscar código de indicação' });
    }
  });

  /**
   * POST /referral/apply
   * Aplica código de indicação (usado no registro)
   */
  fastify.post<{
    Body: {
      referralCode: string;
    };
  }>('/apply', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const result = await referralService.applyReferralCode(
        req.tenant.id,
        req.user.id,
        req.body.referralCode
      );
      return result;
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao aplicar código de indicação');
      return reply.status(500).send({ error: 'Erro ao aplicar código de indicação' });
    }
  });
};

export default referralRoutes;



