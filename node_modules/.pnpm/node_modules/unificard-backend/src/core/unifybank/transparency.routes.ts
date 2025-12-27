// backend/src/core/unifybank/transparency.routes.ts
// Rotas de Transparência Financeira - FASE 6
// Endpoints para extratos, splits e fundos regionais

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { transparencyService } from './transparency.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

// Schemas de validação
const statementQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const regionalFundQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const adminRegionalFundQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const transparencyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /bank/statement
   * Obtém extrato financeiro do usuário autenticado
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * globalUserId vem da sessão
   * 
   * Query params:
   * - limit: número de itens (default: 50, max: 100)
   * - offset: paginação (default: 0)
   * - startDate: data inicial (opcional)
   * - endDate: data final (opcional)
   * 
   * Respostas:
   * - 200: Extrato retornado com sucesso
   * - 401: Não autenticado
   * - 500: Erro inesperado
   */
  fastify.get('/statement', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // 2. Resolver globalUserId
    const globalUserId = await resolveGlobalUserId(userId, tenantId);
    if (!globalUserId) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // 3. Validar query params
    const parsed = statementQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    try {
      const result = await transparencyService.getUserStatement(tenantId, globalUserId, {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });

      return reply.status(200).send({
        success: true,
        statement: result,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching user statement');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch statement',
      });
    }
  });

  /**
   * GET /bank/transaction/:transactionId/splits
   * Obtém detalhe de split de uma transação base
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * 
   * Respostas:
   * - 200: Detalhe de split retornado
   * - 401: Não autenticado
   * - 404: Transação não encontrada ou sem split
   * - 500: Erro inesperado
   */
  fastify.get<{ Params: { transactionId: string } }>('/transaction/:transactionId/splits', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const { transactionId } = req.params;

    // 2. Validar transactionId
    if (!transactionId || typeof transactionId !== 'string') {
      return reply.status(400).send({ error: 'Invalid transaction ID' });
    }

    try {
      const result = await transparencyService.getTransactionSplits(tenantId, transactionId);

      if (!result) {
        return reply.status(404).send({ error: 'Transaction not found' });
      }

      return reply.status(200).send({
        success: true,
        splitDetail: result,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching transaction splits');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch split detail',
      });
    }
  });

  /**
   * GET /bank/regional-fund
   * Obtém visão do fundo regional para o usuário autenticado
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * 
   * Query params:
   * - limit: número de itens (default: 50, max: 100)
   * - offset: paginação (default: 0)
   * 
   * Respostas:
   * - 200: Fundo regional retornado
   * - 401: Não autenticado
   * - 404: Fundo regional não encontrado para o usuário
   * - 500: Erro inesperado
   */
  fastify.get('/regional-fund', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // 2. Resolver globalUserId
    const globalUserId = await resolveGlobalUserId(userId, tenantId);
    if (!globalUserId) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // 3. Validar query params
    const parsed = regionalFundQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    try {
      const result = await transparencyService.getUserRegionalFund(tenantId, globalUserId, {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });

      if (!result) {
        // Região não configurada - retornar resposta vazia (não erro)
        return reply.status(200).send({
          success: true,
          regionalFund: null,
          message: 'Regional fund not configured. Set tenant.city_id to enable.',
        });
      }

      return reply.status(200).send({
        success: true,
        regionalFund: result,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching regional fund');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch regional fund',
      });
    }
  });
};

export default transparencyRoutes;
















