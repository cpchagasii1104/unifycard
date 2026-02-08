// backend/src/modules/loyalty/loyalty.routes.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import type { FastifyInstance } from 'fastify';
import { loyaltyService } from './loyalty.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

/**
 * Rotas REST para Loyalty
 */
const loyaltyRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /loyalty/account?contactId=...
   * Busca conta de fidelidade
   */
  fastify.get<{
    Querystring: { contactId: string };
  }>('/account', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contactId } = req.query;

    if (!contactId) {
      return reply.status(400).send({ error: 'contactId é obrigatório' });
    }

    const account = await loyaltyService.getOrCreateAccount(tenantId, contactId);
    return reply.send(account);
  });

  /**
   * GET /loyalty/ledger?contactId=...&limit=...&offset=...
   * Lista ledger de pontos
   */
  fastify.get<{
    Querystring: {
      contactId: string;
      limit?: number;
      offset?: number;
    };
  }>('/ledger', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contactId, limit, offset } = req.query;

    if (!contactId) {
      return reply.status(400).send({ error: 'contactId é obrigatório' });
    }

    const entries = await loyaltyService.listLedger(tenantId, {
      contactId,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return reply.send({ entries });
  });

  /**
   * POST /loyalty/redeem
   * Resgata pontos criando voucher
   */
  fastify.post<{
    Body: {
      contactId: string;
      points: number;
      voucherType: 'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'BENEFIT_FLAG';
      valueCents: number | null;
      benefitCode?: string | null;
      expiresAt?: string | null;
    };
  }>('/redeem', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contactId, points, voucherType, value, benefitCode, expiresAt } = req.body;

    const result = await loyaltyService.redeemPoints(tenantId, {
      contactId,
      points,
      voucherType,
      valueCents: value || null,
      benefitCode: benefitCode || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    return reply.status(201).send(result);
  });

  /**
   * GET /loyalty/rules
   * Lista regras de fidelidade
   */
  fastify.get<{
    Querystring: {
      status?: 'ACTIVE' | 'INACTIVE';
      appliesTo?: string;
      appliesId?: string;
      limit?: number;
      offset?: number;
    };
  }>('/rules', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query;

    const filters: any = {};
    if (query.status) filters.status = query.status;
    if (query.appliesTo) filters.appliesTo = query.appliesTo;
    if (query.appliesId) filters.appliesId = query.appliesId;
    if (query.limit) filters.limit = parseInt(query.limit as string, 10);
    if (query.offset) filters.offset = parseInt(query.offset as string, 10);

    const rules = await loyaltyService.listRules(tenantId, filters);

    return reply.send({ rules });
  });

  /**
   * POST /loyalty/rules
   * Cria regra de fidelidade
   */
  fastify.post<{
    Body: {
      name: string;
      status?: 'ACTIVE' | 'INACTIVE';
      ruleType: 'PERCENT_OF_AMOUNT' | 'FIXED_POINTS';
      valueCents: number;
      appliesTo: 'CHANNEL' | 'SEGMENT' | 'ACTOR' | 'EVENT' | 'VARIANT' | 'CATEGORY';
      appliesId?: string | null;
      minAmount?: number | null;
      maxPointsPerDay?: number | null;
      validFrom?: string | null;
      validTo?: string | null;
      metadata?: Record<string, any>;
    };
  }>('/rules', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const {
      name,
      status,
      ruleType,
      value,
      appliesTo,
      appliesId,
      minAmount,
      maxPointsPerDay,
      validFrom,
      validTo,
      metadata,
    } = req.body;

    const rule = await loyaltyService.createRule(tenantId, {
      name,
      status,
      ruleType,
      value,
      appliesTo,
      appliesId: appliesId || null,
      minAmount: minAmount || null,
      maxPointsPerDay: maxPointsPerDay || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      metadata,
    });

    return reply.status(201).send(rule);
  });

  /**
   * PATCH /loyalty/rules/:id/status
   * Altera status da regra
   */
  fastify.patch<{
    Params: { id: string };
    Body: { status: 'ACTIVE' | 'INACTIVE' };
  }>('/rules/:id/status', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const ruleId = req.params.id;
    const { status } = req.body;

    await loyaltyService.setRuleStatus(tenantId, ruleId, status);

    return reply.send({ success: true });
  });

  /**
   * GET /loyalty/vouchers?contactId=...&status=...
   * Lista vouchers
   */
  fastify.get<{
    Querystring: {
      contactId: string;
      status?: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
    };
  }>('/vouchers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contactId, status } = req.query;

    if (!contactId) {
      return reply.status(400).send({ error: 'contactId é obrigatório' });
    }

    const vouchers = await loyaltyService.listVouchers(tenantId, contactId, status as any);

    return reply.send({ vouchers });
  });
};

export default loyaltyRoutes;


