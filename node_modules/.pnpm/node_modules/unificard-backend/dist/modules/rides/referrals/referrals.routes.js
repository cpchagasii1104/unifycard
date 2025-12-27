"use strict";
// src/modules/rides/referrals/referrals.routes.ts
//
// Rotas Fastify para referrals no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const referrals_service_1 = require("./referrals.service");
const referralsRoutes = async (fastify) => {
    // =====================================================================
    // GET /drivers/:driverId/referral-code — gerar código de indicação
    // =====================================================================
    fastify.get('/drivers/:driverId/referral-code', {
        preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const code = await referrals_service_1.referralsService.generateDriverReferralCode(tenantId, driverId);
        return { referralCode: code };
    });
    // =====================================================================
    // POST /apply — aplicar código de indicação ao passageiro
    // =====================================================================
    fastify.post('/apply', {
        preHandler: [fastify.requirePermission(['rides:referrals:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            throw new errors_1.BadRequestError('Missing tenant or user context');
        const { promoCode } = req.body;
        const result = await referrals_service_1.referralsService.applyReferralCode(tenantId, userId, promoCode);
        return result;
    });
    // =====================================================================
    // GET /drivers/:driverId/earnings — listar ganhos de referral
    // =====================================================================
    fastify.get('/drivers/:driverId/earnings', {
        preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const earnings = await referrals_service_1.referralsService.listDriverReferralEarnings(tenantId, driverId);
        return earnings;
    });
    // =====================================================================
    // GET /drivers/:driverId/summary — resumo de ganhos
    // =====================================================================
    fastify.get('/drivers/:driverId/summary', {
        preHandler: [fastify.requirePermission(['rides:referrals:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const summary = await referrals_service_1.referralsService.getDriverReferralSummary(tenantId, driverId);
        return summary;
    });
};
exports.default = referralsRoutes;
//# sourceMappingURL=referrals.routes.js.map