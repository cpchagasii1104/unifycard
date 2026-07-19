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
        // 🔒 DECISION-0189 (F3): extrato por actor = autoridade EXATA e TERMINAL
        // (self OU company_users.can_view_financial de membership ativa), leitura sob o
        // lock FOR SHARE da membership (R13). Capability de projeção NÃO decide mais.
        const { authorizeActorFinancialRead } = await import('@core/authorization/financial-read-authority');
        const outcome = await authorizeActorFinancialRead(tenantId, userId, parsed.data.actorId, () =>
          transparencyService.getActorStatement(tenantId, parsed.data.actorId!, {
            limit: parsed.data.limit,
            offset: parsed.data.offset,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
          })
        );
        if (!outcome.allowed) {
          return reply.status(403).send({ error: 'No exact financial read authority over this actor' });
        }
        // R18: audit ANTES da resposta (falha de auditoria = 500, sem disclosure sem rastro)
        const { recordFinancialAudit } = await import('@core/observability/financial-audit');
        await recordFinancialAudit({
          tenant_id: tenantId,
          event_type: 'financial_read_statement',
          actor_id: parsed.data.actorId,
          metadata: { readBy: userId, role: outcome.role, route: 'GET /bank/statement' },
        });
        result = outcome.result;
      } else {
        result = await transparencyService.getUserStatement(tenantId, globalUserId, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
      }

      // ✅ Sempre retornar 200, mesmo se não houver conta (resultado vazio)
      reply.header('Cache-Control', 'no-store'); // DECISION-0189 §10: leitura financeira privada
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
      // 🔒 DECISION-0189 (F3, §10 — política de splits): AUTORIZAÇÃO PELO RECURSO.
      // Transação e conta de ORIGEM carregadas SERVER-SIDE (porta do Bank); nada do cliente
      // define o objeto. RESPOSTA POR PAPEL:
      //   • dono humano da origem (self) OU view_financial terminal na empresa dona da origem
      //     → visão INTEGRAL;
      //   • participante destinatário → SÓ as próprias pernas + resumo SANITIZADO
      //     (sem pernas de terceiros, sem metadata bruta, sem topologia);
      //   • sem papel OU UUID inexistente → 404 UNIFORME (mesmo status/corpo — anti-enumeração).
      const { bankPortsRegistry } = await import('@core/bank/ports-registry');
      const origin = await bankPortsRegistry
        .getBankTransactionRead()
        .getOriginAccountByTransactionId(tenantId, transactionId);

      const NOT_FOUND_BODY = { error: 'Transaction not found' } as const;
      if (!origin) {
        return reply.status(404).send(NOT_FOUND_BODY);
      }

      const userId = req.user.id;
      const { hasCompanyViewFinancialGrant } = await import('@core/authorization/financial-read-authority');

      let role: 'integral' | 'participant' | null = null;
      if (origin.ownerType === 'user' && origin.ownerId === userId) {
        role = 'integral';
      } else if (origin.ownerType === 'company' && (await hasCompanyViewFinancialGrant(tenantId, userId, origin.ownerId))) {
        role = 'integral';
      }

      const result = await transparencyService.getTransactionSplits(tenantId, transactionId);
      if (!result) {
        return reply.status(404).send(NOT_FOUND_BODY);
      }

      if (role !== 'integral') {
        // papel de participante: pernas cujo dono é o caller (user) ou empresa com grant
        const ownLegs = [] as typeof result.splits;
        const companyGrantCache = new Map<string, boolean>();
        for (const leg of result.splits) {
          if (!leg.targetId) continue;
          if (leg.targetType === 'user' && leg.targetId === userId) {
            ownLegs.push(leg);
            continue;
          }
          if (leg.targetType !== 'user') {
            let ok = companyGrantCache.get(leg.targetId);
            if (ok === undefined) {
              ok = await hasCompanyViewFinancialGrant(tenantId, userId, leg.targetId).catch(() => false);
              companyGrantCache.set(leg.targetId, ok);
            }
            if (ok) ownLegs.push(leg);
          }
        }
        if (ownLegs.length === 0) {
          // resposta UNIFORME com inexistente (não revela existência/topologia)
          return reply.status(404).send(NOT_FOUND_BODY);
        }
        role = 'participant';
        const { recordFinancialAudit } = await import('@core/observability/financial-audit');
        await recordFinancialAudit({
          tenant_id: tenantId,
          event_type: 'financial_read_splits',
          transaction_id: transactionId,
          metadata: { readBy: userId, role, legs: ownLegs.length, route: 'GET /bank/transaction/:id/splits' },
        });
        reply.header('Cache-Control', 'no-store');
        return reply.status(200).send({
          success: true,
          splitDetail: {
            baseTransaction: {
              transactionId: result.baseTransaction.transactionId,
              createdAt: result.baseTransaction.createdAt,
              // SEM amount total, SEM metadata bruta, SEM type — resumo sanitizado
            },
            splits: ownLegs,
            redacted: true,
          },
        });
      }

      // papel integral
      const { recordFinancialAudit } = await import('@core/observability/financial-audit');
      await recordFinancialAudit({
        tenant_id: tenantId,
        event_type: 'financial_read_splits',
        transaction_id: transactionId,
        account_id: origin.accountId,
        metadata: { readBy: userId, role, route: 'GET /bank/transaction/:id/splits' },
      });
      reply.header('Cache-Control', 'no-store');
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

















