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
  // 2026-05-18 P1 — actor-context. Quando presente, valida authority via
  // actorCapabilitiesService e resolve extrato por actor (user/page/group).
  actorId: z.string().uuid().optional(),
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
  // GET /bank/balance → bank-http.routes.ts (resposta canónica com balanceCents + balance legado)

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
    // 🔴 REGRA DE OURO: Usuário autenticado + tenant válido → SEMPRE retornar 200
    // 401 é EXCLUSIVO para token inválido/sessão expirada (já tratado pelo auth plugin)
    
    // F-C1-HOME-READ-SEAL (CP7): falha de auth/tenant NÃO vira extrato vazio falso — erro observável.
    if (!req.user || !req.user.id) {
      fastify.log.warn('Usuário não autenticado em /bank/statement (auth plugin deveria ter bloqueado)');
      return reply.status(401).send({ success: false, code: 'UNAUTHENTICATED', error: 'Não autenticado' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ success: false, code: 'TENANT_NOT_FOUND', error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Sem identidade bancária (global_user) = AUSÊNCIA honesta: zero movimentos é materialmente
    // verdadeiro para quem não tem conta — distinto de ERRO estrutural (500 no catch).
    const globalUserId = await resolveGlobalUserId(userId, tenantId);
    if (!globalUserId) {
      fastify.log.debug({ userId, tenantId }, 'globalUserId não encontrado - extrato vazio (ausência honesta)');
      return reply.status(200).send({
        success: true,
        statement: {
          entries: [],
          totalCents: 0,
          hasMore: false,
        },
      });
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
      let result;
      if (parsed.data.actorId) {
        // 2026-05-18 P1 — actor-context. Valida authority via capability resolver.
        const { actorCapabilitiesService } = await import('@core/actor-capabilities/actor-capabilities.service');
        const caps = await actorCapabilitiesService.resolveForUser(tenantId, parsed.data.actorId, userId);
        if (!caps) {
          return reply.status(403).send({ error: 'User has no authority over this actor' });
        }
        const allowed = caps.capabilities.includes('bank.view_balance')
          || caps.capabilities.includes('company.view_reports')
          || caps.capabilities.includes('company.manage_financial')
          || caps.capabilities.includes('company.manage_company');
        if (!allowed) {
          return reply.status(403).send({ error: 'Authority over actor present but no capability to view statement' });
        }
        result = await transparencyService.getActorStatement(tenantId, parsed.data.actorId, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
      } else {
        result = await transparencyService.getUserStatement(tenantId, globalUserId, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
      }

      // ✅ Sempre retornar 200, mesmo se não houver conta (resultado vazio)
      return reply.status(200).send({
        success: true,
        statement: result,
      });
    } catch (error) {
      // F-C1-HOME-READ-SEAL (CP7): ERRO ESTRUTURAL nunca vira extrato vazio falso (200 + []).
      fastify.log.error({ err: error, userId, tenantId, globalUserId, actorId: parsed.data.actorId }, 'Error fetching user statement');
      return reply.status(500).send({
        success: false,
        code: 'BANK_STATEMENT_UNAVAILABLE',
        error: 'Extrato indisponível (erro estrutural). Não é um extrato vazio.',
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
    // 🔴 REGRA DE OURO: Usuário autenticado + tenant válido → SEMPRE retornar 200
    // 401 é EXCLUSIVO para token inválido/sessão expirada (já tratado pelo auth plugin)
    
    // F-C1-HOME-READ-SEAL (CP7): falha de auth/tenant NÃO vira fundo nulo falso — erro observável.
    if (!req.user || !req.user.id) {
      fastify.log.warn('Usuário não autenticado em /bank/regional-fund (auth plugin deveria ter bloqueado)');
      return reply.status(401).send({ success: false, code: 'UNAUTHENTICATED', error: 'Não autenticado' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ success: false, code: 'TENANT_NOT_FOUND', error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Convergência territorial (Fatia D): o fundo regional é resolvido pela RESIDÊNCIA actor-scoped
    // do principal (DECISION-0177/0020), NÃO pela identidade bancária. Por isso não há mais gate por
    // globalUserId aqui — o serviço devolve estados territoriais honestos (residence_missing etc.),
    // nunca R$ 0,00 por ausência nem fundo mono-tenant.

    // 3. Validar query params
    const parsed = regionalFundQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    try {
      const result = await transparencyService.getUserRegionalFund(tenantId, userId, {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });

      // ✅ Sempre 200 com o estado territorial explícito (o front projeta; nunca inventa verdade).
      return reply.status(200).send({
        success: true,
        regionalFund: result,
      });
    } catch (error) {
      // F-C1-HOME-READ-SEAL (CP7): ERRO ESTRUTURAL nunca vira fundo "null" falso em 200 — erro é erro
      // (500 observável). O estado de sucesso carrega o resourceState territorial.
      fastify.log.error({ err: error, userId, tenantId }, 'Error fetching regional fund');
      return reply.status(500).send({
        success: false,
        code: 'REGIONAL_FUND_UNAVAILABLE',
        error: 'Fundo regional indisponível (erro estrutural).',
      });
    }
  });
};

export default transparencyRoutes;

















