// backend/src/core/unifybank/bank-balance-consolidation.routes.ts
// READ-MODEL: Rotas administrativas de Balanço Financeiro Consolidado
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { bankBalanceConsolidationService } from '@modules/bank/bank-balance-consolidation.service';
import { bankBalanceByCpfService } from '@modules/bank/bank-balance-by-cpf.service';
import { bankBalanceByRegionService } from '@modules/bank/bank-balance-by-region.service';
import { bankReconciliationHistoryRepository } from '@modules/bank/bank-reconciliation-history.repository';

// Schema de validação para query params
const consolidatedBalanceQuerySchema = z.object({
  currency: z.union([
    z.enum(['BRL', 'USD', 'EUR', 'TEST']),
    z.array(z.enum(['BRL', 'USD', 'EUR', 'TEST'])),
  ]).optional(),
  ownerType: z.enum(['user', 'company', 'system']).optional(),
  activeOnly: z.coerce.boolean().optional().default(false),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Schema de validação para body de reconciliação
const reconciliationBodySchema = z.object({
  externalBalanceCents: z.number().int().min(0),
});

const bankBalanceConsolidationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/finance/consolidated-balance
   * Obtém balanço financeiro consolidado (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Sempre calcula on-demand (nunca persiste)
   * 
   * Query params:
   * - currency: Filtrar por moeda (opcional)
   * - ownerType: Filtrar por tipo de owner (opcional)
   * - activeOnly: Incluir apenas contas com saldo != 0 (default: false)
   * 
   * Respostas:
   * - 200: Balanço consolidado retornado
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 500: Erro inesperado
   */
  fastify.get('/consolidated-balance', {
    preHandler: [fastify.requirePermission(['admin:view_consolidated_balance'])],
  }, async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;

    // 2. Validar query params
    const parsed = consolidatedBalanceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    try {
      // 3. Obter balanço consolidado (READ-MODEL - calcula on-demand)
      const consolidatedBalance = await bankBalanceConsolidationService.getConsolidatedBalance(
        tenantId,
        {
          currency: parsed.data.currency,
          ownerType: parsed.data.ownerType,
          activeOnly: parsed.data.activeOnly,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        }
      );

      return reply.status(200).send({
        success: true,
        balance: consolidatedBalance,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching consolidated balance');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch consolidated balance',
      });
    }
  });

  /**
   * POST /admin/finance/consolidated-balance/reconciliation
   * Cria entrada de reconciliação bancária (INPUT MANUAL)
   * 
   * REGRAS ABSOLUTAS:
   * - externalBalance é INPUT MANUAL do administrador
   * - NÃO integra com banco externo
   * - NÃO aciona decisões automáticas
   * - Histórico é append-only (sem update/delete)
   * - Persiste no histórico para auditoria
   * 
   * Body:
   * - externalBalance: Saldo bancário externo (INPUT MANUAL)
   * - currency: Moeda (opcional, default: BRL)
   * - notes: Observações (opcional)
   * 
   * Respostas:
   * - 200: Reconciliação criada e retornada
   * - 400: Dados inválidos
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 500: Erro inesperado
   */
  fastify.post<{ Body: { externalBalanceCents: number; currency?: string; notes?: string } }>('/consolidated-balance/reconciliation', {
    preHandler: [fastify.requirePermission(['admin:view_consolidated_balance'])],
  }, async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // 2. Validar body
    const bodySchema = z.object({
      externalBalanceCents: z.number().int().min(0),
      currency: z.enum(['BRL', 'USD', 'EUR', 'TEST']).optional().default('BRL'),
      notes: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      // 3. Obter balanço consolidado atual
      const consolidatedBalance = await bankBalanceConsolidationService.getConsolidatedBalance(
        tenantId,
        {
          currency: parsed.data.currency,
        }
      );

      // 4. Calcular diferença
      const differenceCents =
        consolidatedBalance.reconciliation.internalBalanceCents - parsed.data.externalBalanceCents;

      // 5. Persistir no histórico (append-only)
      const historyEntry = await bankReconciliationHistoryRepository.create(tenantId, {
        internalBalanceCents: consolidatedBalance.reconciliation.internalBalanceCents,
        externalBalanceCents: parsed.data.externalBalanceCents,
        differenceCents,
        currency: parsed.data.currency,
        filtersApplied: {
          currency: parsed.data.currency,
        },
        notes: parsed.data.notes,
        performedByUserId: userId,
      });

      // 6. Retornar reconciliação atualizada
      const updatedBalance = bankBalanceConsolidationService.updateReconciliation(
        consolidatedBalance,
        parsed.data.externalBalanceCents
      );

      return reply.status(200).send({
        success: true,
        balance: updatedBalance,
        reconciliationId: historyEntry.reconciliationId,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error creating reconciliation');
      return reply.status(500).send({
        error: err.message || 'Failed to create reconciliation',
      });
    }
  });

  /**
   * GET /admin/finance/consolidated-balance/reconciliation/history
   * Lista histórico de reconciliações bancárias (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Histórico é append-only (sem update/delete)
   * 
   * Query params:
   * - currency: Filtrar por moeda (opcional)
   * - startDate: Data inicial (opcional)
   * - endDate: Data final (opcional)
   * - limit: Limite de registros (opcional, default: 100)
   * - offset: Offset para paginação (opcional, default: 0)
   * 
   * Respostas:
   * - 200: Histórico de reconciliações retornado
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 500: Erro inesperado
   */
  fastify.get<{
    Querystring: {
      currency?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/consolidated-balance/reconciliation/history', {
    preHandler: [fastify.requirePermission(['admin:view_consolidated_balance'])],
  }, async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const query = req.query as any;

    try {
      const history = await bankReconciliationHistoryRepository.list(tenantId, {
        currency: query.currency as any,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit ? parseInt(query.limit.toString(), 10) : 100,
        offset: query.offset ? parseInt(query.offset.toString(), 10) : 0,
      });

      return reply.status(200).send({
        success: true,
        history,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching reconciliation history');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch reconciliation history',
      });
    }
  });

  /**
   * GET /admin/finance/consolidated-balance/reconciliation/history/:reconciliationId
   * Busca entrada específica de histórico de reconciliação (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * 
   * Respostas:
   * - 200: Entrada de histórico retornada
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 404: Entrada não encontrada
   * - 500: Erro inesperado
   */
  fastify.get<{ Params: { reconciliationId: string } }>(
    '/consolidated-balance/reconciliation/history/:reconciliationId',
    {
      preHandler: [fastify.requirePermission(['admin:view_consolidated_balance'])],
    },
    async (req, reply) => {
      if (!req.user || !req.user.id) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      const tenantId = req.tenant.id;
      const { reconciliationId } = req.params;

      try {
        const entry = await bankReconciliationHistoryRepository.findById(tenantId, reconciliationId);

        if (!entry) {
          return reply.status(404).send({
            error: 'Reconciliação não encontrada',
          });
        }

        return reply.status(200).send({
          success: true,
          entry,
        });
      } catch (error) {
        const err = error as Error;
        fastify.log.error({ err: error }, 'Error fetching reconciliation entry');
        return reply.status(500).send({
          error: err.message || 'Failed to fetch reconciliation entry',
        });
      }
    }
  );

  /**
   * GET /admin/finance/consolidated-balance/by-cpf/:cpf
   * Obtém consolidação de balanço por CPF (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Sempre calcula on-demand (nunca persiste)
   * - NÃO cria conta consolidada por CPF
   * - NÃO mistura saldos contábeis
   * - NÃO altera ledger
   * - NÃO persiste saldo consolidado
   * 
   * Params:
   * - cpf: CPF (pode ter formatação, será normalizado)
   * 
   * Respostas:
   * - 200: Consolidação por CPF retornada
   * - 400: CPF inválido
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 404: CPF não encontrado
   * - 500: Erro inesperado
   */
  fastify.get<{ Params: { cpf: string } }>('/consolidated-balance/by-cpf/:cpf', {
    preHandler: [fastify.requirePermission(['admin:view_consolidated_balance'])],
  }, async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const { cpf } = req.params;

    try {
      // 2. Obter consolidação por CPF (READ-MODEL - calcula on-demand)
      const balanceByCpf = await bankBalanceByCpfService.getBalanceByCpf(tenantId, cpf);

      return reply.status(200).send({
        success: true,
        balance: balanceByCpf,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching balance by CPF');

      if (err.message.includes('não encontrado') || err.message.includes('Nenhum')) {
        return reply.status(404).send({
          error: err.message || 'CPF não encontrado',
        });
      }

      if (err.message.includes('inválido')) {
        return reply.status(400).send({
          error: err.message || 'CPF inválido',
        });
      }

      return reply.status(500).send({
        error: err.message || 'Failed to fetch balance by CPF',
      });
    }
  });

  /**
   * GET /admin/finance/consolidated-balance/by-region
   * Lista todos os fundos regionais (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Sempre calcula on-demand (nunca persiste)
   * - FONTE CANÔNICA: conta de sistema regional_fund
   * 
   * Query params:
   * - currency: Filtrar por moeda (opcional)
   * 
   * Respostas:
   * - 200: Lista de fundos regionais retornada
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 500: Erro inesperado
   */
  fastify.get('/consolidated-balance/by-region', {
    preHandler: [fastify.requirePermission(['admin:view_regional_fund'])],
  }, async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const query = req.query as any;

    try {
      const funds = await bankBalanceByRegionService.listRegionalFunds(
        tenantId,
        query.currency
      );

      return reply.status(200).send({
        success: true,
        funds,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching regional funds');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch regional funds',
      });
    }
  });

  /**
   * GET /admin/finance/consolidated-balance/by-region/:regionId
   * Obtém informações de um fundo regional específico (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Sempre calcula on-demand (nunca persiste)
   * - FONTE CANÔNICA: conta de sistema regional_fund
   * 
   * Query params:
   * - currency: Moeda (opcional, default: BRL)
   * 
   * Respostas:
   * - 200: Informações do fundo regional retornadas
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 404: Fundo regional não encontrado
   * - 500: Erro inesperado
   */
  fastify.get<{ Params: { regionId: string }; Querystring: { currency?: string } }>(
    '/consolidated-balance/by-region/:regionId',
    {
      preHandler: [fastify.requirePermission(['admin:view_regional_fund'])],
    },
    async (req, reply) => {
      if (!req.user || !req.user.id) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      const tenantId = req.tenant.id;
      const { regionId } = req.params;
      const query = req.query as any;

      try {
        const fund = await bankBalanceByRegionService.getRegionalFund(
          tenantId,
          regionId,
          (query.currency as any) || 'BRL'
        );

        if (!fund) {
          return reply.status(404).send({
            error: 'Fundo regional não encontrado',
          });
        }

        return reply.status(200).send({
          success: true,
          fund,
        });
      } catch (error) {
        const err = error as Error;
        fastify.log.error({ err: error }, 'Error fetching regional fund');
        return reply.status(500).send({
          error: err.message || 'Failed to fetch regional fund',
        });
      }
    }
  );

  /**
   * GET /admin/finance/consolidated-balance/by-region/:regionId/history
   * Obtém histórico de transações do fundo regional (READ-MODEL)
   * 
   * REGRAS ABSOLUTAS:
   * - Apenas leitura (não grava nada)
   * - Apenas admin institucional
   * - Não dispara side-effects
   * - Sempre calcula on-demand (nunca persiste)
   * - FONTE CANÔNICA: bank_ledger + bank_transactions
   * - NÃO criar nova fonte de verdade
   * 
   * Query params:
   * - currency: Moeda (opcional, default: BRL)
   * - startDate: Data inicial (opcional)
   * - endDate: Data final (opcional)
   * - limit: Limite de registros (opcional, default: 100)
   * - offset: Offset para paginação (opcional, default: 0)
   * 
   * Respostas:
   * - 200: Histórico do fundo regional retornado
   * - 401: Não autenticado
   * - 403: Não é admin
   * - 404: Fundo regional não encontrado
   * - 500: Erro inesperado
   */
  fastify.get<{
    Params: { regionId: string };
    Querystring: {
      currency?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/consolidated-balance/by-region/:regionId/history', {
    preHandler: [fastify.requirePermission(['admin:view_regional_fund'])],
  }, async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const { regionId } = req.params;
    const query = req.query as any;

    try {
      const history = await bankBalanceByRegionService.getRegionalFundHistory(
        tenantId,
        regionId,
        (query.currency as any) || 'BRL',
        query.startDate ? new Date(query.startDate) : undefined,
        query.endDate ? new Date(query.endDate) : undefined,
        query.limit ? parseInt(query.limit.toString(), 10) : 100,
        query.offset ? parseInt(query.offset.toString(), 10) : 0
      );

      return reply.status(200).send({
        success: true,
        history,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching regional fund history');

      if (err.message.includes('não encontrado')) {
        return reply.status(404).send({
          error: err.message || 'Fundo regional não encontrado',
        });
      }

      return reply.status(500).send({
        error: err.message || 'Failed to fetch regional fund history',
      });
    }
  });
};

export default bankBalanceConsolidationRoutes;

