"use strict";
// src/modules/rides/promotions/promotions.routes.ts
//
// Rotas Fastify para promoções no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const promotions_service_1 = require("./promotions.service");
const promotionsRoutes = async (fastify) => {
    // =====================================================================
    // POST /promotions — criar promoção
    // =====================================================================
    fastify.post('/', {
        preHandler: [fastify.requirePermission(['rides:promotions:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const promotion = await promotions_service_1.promotionsService.createPromotion(tenantId, req.body);
        reply.code(201);
        return promotion;
    });
    // =====================================================================
    // GET /promotions/:promoCode — buscar promoção por código
    // =====================================================================
    fastify.get('/:promoCode', {
        preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { promoCode } = req.params;
        const promotion = await promotions_service_1.promotionsService.getPromotionByCode(tenantId, promoCode);
        if (!promotion) {
            throw new errors_1.NotFoundError('Promotion not found');
        }
        return promotion;
    });
    // =====================================================================
    // POST /promotions/validate — validar elegibilidade
    // =====================================================================
    fastify.post('/validate', {
        preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { promoCode, rideData } = req.body;
        const promotion = await promotions_service_1.promotionsService.validatePromotion(tenantId, promoCode, rideData);
        return promotion;
    });
    // =====================================================================
    // GET /promotions — listar promoções disponíveis
    // =====================================================================
    fastify.get('/', {
        preHandler: [fastify.requirePermission(['rides:promotions:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { cityId, serviceTypeId } = req.query;
        const promotions = await promotions_service_1.promotionsService.listAvailablePromotions(tenantId, cityId || '', serviceTypeId || '');
        return promotions;
    });
};
exports.default = promotionsRoutes;
