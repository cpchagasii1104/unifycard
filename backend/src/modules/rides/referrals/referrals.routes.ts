// src/modules/rides/referrals/referrals.routes.ts
//
// Rotas Fastify para referrals no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { referralsService } from './referrals.service';

interface ApplyReferralCodeBody {
  promoCode: string;
}

const referralsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /drivers/:driverId/referral-code — gerar código de indicação
  // =====================================================================
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/referral-code',
    {
      preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const code = await referralsService.generateDriverReferralCode(tenantId, driverId);
      return { referralCode: code };
    }
  );

  // =====================================================================
  // POST /apply — aplicar código de indicação ao passageiro
  // =====================================================================
  fastify.post<{ Body: ApplyReferralCodeBody }>(
    '/apply',
    {
      preHandler: [fastify.requirePermission(['rides:referrals:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { promoCode } = req.body;
      const result = await referralsService.applyReferralCode(tenantId, userId, promoCode);
      return result;
    }
  );

  // =====================================================================
  // GET /drivers/:driverId/earnings — listar ganhos de referral
  // =====================================================================
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/earnings',
    {
      preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const earnings = await referralsService.listDriverReferralEarnings(tenantId, driverId);
      return earnings;
    }
  );

  // =====================================================================
  // GET /drivers/:driverId/summary — resumo de ganhos
  // =====================================================================
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/summary',
    {
      preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const summary = await referralsService.getDriverReferralSummary(tenantId, driverId);
      return summary;
    }
  );
};

export default referralsRoutes;
