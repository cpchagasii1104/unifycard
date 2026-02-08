// src/modules/rides/promotions/promotions.routes.ts
//
// Rotas Fastify para promoções no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError, NotFoundError } from '@core/errors';
import { promotionsService } from './promotions.service';

interface CreatePromotionBody {
  title: string;
  description?: string;
  promo_code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses?: number;
  startsAt?: Date;
  expiresAt?: Date;
  min_distance_km?: number;
  min_price?: number;
  applicable_city_id?: string;
  applicable_service_type_id?: string;
}

interface ValidatePromotionBody {
  promoCode: string;
  rideData: {
    city_id?: string;
    service_type_id?: string;
    estimated_price?: number;
    total_distance_km?: number;
  };
}

interface ListPromotionsQuery {
  cityId?: string;
  serviceTypeId?: string;
}

const promotionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /promotions — criar promoção
  // =====================================================================
  fastify.post<{ Body: CreatePromotionBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:promotions:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const promotion = await promotionsService.createPromotion(tenantId, req.body);

      reply.code(201);
      return promotion;
    }
  );

  // =====================================================================
  // GET /promotions/:promoCode — buscar promoção por código
  // =====================================================================
  fastify.get<{ Params: { promoCode: string } }>(
    '/:promoCode',
    {
      preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { promoCode } = req.params;
      const promotion = await promotionsService.getPromotionByCode(tenantId, promoCode);

      if (!promotion) {
        throw new NotFoundError('Promotion not found');
      }

      return promotion;
    }
  );

  // =====================================================================
  // POST /promotions/validate — validar elegibilidade
  // =====================================================================
  fastify.post<{ Body: ValidatePromotionBody }>(
    '/validate',
    {
      preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { promoCode, rideData } = req.body;
      const promotion = await promotionsService.validatePromotion(tenantId, promoCode, rideData);
      return promotion;
    }
  );

  // =====================================================================
  // GET /promotions — listar promoções disponíveis
  // =====================================================================
  fastify.get<{ Querystring: ListPromotionsQuery }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { cityId, serviceTypeId } = req.query;
      const promotions = await promotionsService.listAvailablePromotions(
        tenantId,
        cityId || '',
        serviceTypeId || ''
      );

      return promotions;
    }
  );
};

export default promotionsRoutes;

