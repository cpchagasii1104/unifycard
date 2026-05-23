// src/core/unifybank/test-currency.routes.ts
//
// Rotas administrativas para gerenciar moeda fictícia de teste (TEST)
// Apenas role 'admin' pode acessar

import { FastifyPluginAsync } from 'fastify';
import { testCurrencyService } from './test-currency.service';
import { z } from 'zod';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { requireFinancialRiskClearance } from '@modules/risk-identity/risk-financial-gate';

const emitTestCurrencySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  amountCents: z.number().positive('Amount must be positive').max(1000000, 'Maximum amount is 1,000,000'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});

const testCurrencyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /admin/test-currency/emit
   * Emite saldo fictício (TEST) para um usuário
   * Apenas ADMIN pode emitir
   */
  fastify.post<{
    Body: {
      userId: string;
      amountCents: number;
      reason: string;
    };
  }>(
    '/emit',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'amount', 'reason'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            amountCents: { type: 'number', minimum: 0.01, maximum: 1000000 },
            reason: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
      },
      preHandler: async (req, reply) => {
        // Validar role admin
        await (fastify as any).requireRole(['admin'])(req, reply);
      },
    },
    async (req, reply) => {
      if (!req.user || !req.tenant) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      const parsed = emitTestCurrencySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          message: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        // AUTORIDADE: ensureUserActor → gate → transfer (INV-ID + INV-FIN)
        const adminActor = await ensureUserActor(req.tenant.id, req.user.id);
        if (!adminActor?.actor_id) {
          return reply.status(400).send({ ok: false, message: 'ACTOR_ID_NOT_RESOLVED' });
        }
        await requireFinancialRiskClearance(req.tenant.id, {
          actorId: adminActor.actor_id,
          action: 'financial_transfer',
          amountCents: parsed.data.amountCents,
        });

        const result = await testCurrencyService.emitTestCurrency({
          tenantId: req.tenant.id,
          userId: parsed.data.userId,
          amountCents: parsed.data.amountCents,
          reason: parsed.data.reason,
          adminId: req.user.id,
        });

        return reply.status(201).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao emitir moeda de teste');
        return reply.status(500).send({
          ok: false,
          message: error instanceof Error ? error.message : 'Erro ao emitir moeda de teste',
        });
      }
    }
  );

  /**
   * GET /admin/test-currency/ledger
   * Lista emissões de TEST para um usuário
   * Apenas ADMIN pode acessar
   */
  fastify.get<{
    Querystring: {
      userId: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/ledger',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            offset: { type: 'number', minimum: 0 },
          },
        },
      },
      preHandler: async (req, reply) => {
        // Validar role admin
        await (fastify as any).requireRole(['admin'])(req, reply);
      },
    },
    async (req, reply) => {
      if (!req.user || !req.tenant) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      try {
        const result = await testCurrencyService.getTestCurrencyLedger(
          req.tenant.id,
          req.query.userId,
          req.query.limit || 50,
          req.query.offset || 0
        );

        return reply.send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar ledger de moeda de teste');
        return reply.status(500).send({
          ok: false,
          message: error instanceof Error ? error.message : 'Erro ao buscar ledger de moeda de teste',
        });
      }
    }
  );
};

export default testCurrencyRoutes;





























