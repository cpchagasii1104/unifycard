// backend/src/modules/reports/reports.routes.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Rotas REST

import type { FastifyInstance } from 'fastify';
import { salesReportService } from './sales-report.service';
// financial-report.service NÃO é mais importado: GET /financial está contido em 501
// (F-FINANCIAL-REPORT-CONTAINMENT). O service segue intacto — sumiu a aresta, não o código.
import { inventoryReportService } from './inventory-report.service';
import { inventorySlaService } from '../marketplace/inventory-sla.service';
import { inventorySuggestionService } from '../marketplace/inventory-suggestion.service';
import { inventoryHoldingCostService } from '../marketplace/inventory-holding-cost.service';
import { realMarginService } from '../marketplace/real-margin.service';
import { decisionSimulationService } from '../marketplace/decision-simulation.service';
import { pricingStrategyService } from '../marketplace/pricing-strategy.service';
import type { SalesReportFilters } from './sales-report.types';
import type { InventoryReportFilters } from './inventory-report.types';
import type { GetStockAgingOptions, GetTransferSlaOptions, SlaConfig } from '../marketplace/inventory-sla.types';
import type { GetInventorySuggestionsOptions, SuggestionConfig } from '../marketplace/inventory-suggestion.types';
import type { GetHoldingCostsOptions, HoldingCostConfig } from '../marketplace/inventory-holding-cost.types';
import type { GetMarginOptions, MarginConfig } from '../marketplace/real-margin.types';
import type { SimulationInput } from '../marketplace/decision-simulation.types';
import type { GetPricingStrategyOptions } from '../marketplace/pricing-strategy.types';
import { authorizationService } from '@core/authorization/authorization.service';

/**
 * 🔴 DECISION-0113 — resolve o actorId AUTORIZADO de um relatório dashboard/reports.
 * `reports:view_operational` prova acesso ao MÓDULO (ownership do PRÓPRIO actor), NÃO autoridade sobre o actor
 * filtrado. `query.actorId` é HINT → exigir canRepresentActor; sem query.actorId → self via actionContext
 * (validado). Sem tenant-wide silencioso. Envia 401/403/400 e retorna null se negado.
 */
async function resolveReportActorId(req: any, reply: any): Promise<string | null> {
  const userId = req?.user?.userId as string | undefined;
  if (!userId) { reply.status(401).send({ ok: false, error: 'Autenticação obrigatória (req.user.userId)' }); return null; }
  if (!req.actionContext?.actorId) { reply.status(400).send({ ok: false, error: 'ActionContext obrigatório' }); return null; }
  const target = req.query?.actorId ? String(req.query.actorId) : String(req.actionContext.actorId);
  let canRep = false;
  try { canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, target); } catch { canRep = false; }
  if (!canRep) { reply.status(403).send({ ok: false, error: 'Sem autoridade sobre o actor do relatório (canRepresentActor)', code: 'REPORT_ACTOR_NOT_REPRESENTABLE' }); return null; }
  return target;
}

const reportsRoutes = async (fastify: FastifyInstance) => {
  // GET /reports/sales
  fastify.get('/sales', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    const query = req.query as any;

    const filters: SalesReportFilters = {};

    if (query.startDate) {
      filters.startDate = new Date(query.startDate);
    }

    if (query.endDate) {
      filters.endDate = new Date(query.endDate);
    }

    // 🔴 DECISION-0113 / Z2-R3: query.actorId é HINT → representável OU self via actionContext (canRepresentActor).
    // `reports:view_operational` prova acesso ao MÓDULO, NÃO autoridade sobre o actor filtrado. 403 senão.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return; // 401/403/400 já enviado
    filters.actorId = authorizedActorId;

    if (query.channel) {
      filters.channel = query.channel as 'PDV' | 'MARKETPLACE' | 'ALL';
    }

    // SPRINT 51: Multi-empresa e consolidação
    if (query.organizationUnitId) {
      filters.organizationUnitId = query.organizationUnitId;
    }
    if (query.consolidated === 'true') {
      // FASE 4: Verificação obrigatória de consolidated
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.user?.id) {
        return reply.status(401).send({ error: 'Autenticação obrigatória para relatório consolidado' });
      }

      // N3: mesmo padrão que dashboard — RBAC no preHandler + authority com userId humano
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        req.actionContext.actorId,
        'view_consolidated_reports',
        undefined,
        {
          tenantId,
          userId: req.user.id,
        }
      );
      if (!auth.allowed) {
        return reply.status(403).send({
          error: 'Permission denied',
          message: 'view_consolidated_reports permission required for consolidated reports',
        });
      }
      filters.consolidated = true;
    }

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const report = await salesReportService.generateReport(tenantId, {
      ...filters,
      userId: actionContext.actorId,
      actorId: actionContext.actorId,
    });
    return reply.status(200).send(report);
  });

  // GET /reports/inventory
  fastify.get('/inventory', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: InventoryReportFilters = {};

    if (query.variantId) {
      filters.variantId = query.variantId;
    }

    if (query.productId) {
      filters.productId = query.productId;
    }

    if (query.startDate) {
      filters.startDate = new Date(query.startDate);
    }

    if (query.endDate) {
      filters.endDate = new Date(query.endDate);
    }

    const report = await inventoryReportService.generateReport(tenantId, filters);
    return reply.status(200).send(report);
  });

  // GET /reports/financial
  // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
  // ║ STATUS:  CONTIDO — F-FINANCIAL-REPORT-CONTAINMENT (2026-08-01)
  // ║ NORMA:   mesmo veredito das rotas de métricas de evento: religar sem consumidor é
  // ║          trabalho morto que envelhece
  // ║ NÃO:     "consertar" o service para reviver isto. getSummary/getFinancialBySplit fazem
  // ║          JOIN em `payout_transactions` e `payment_intent_splits` — AMBAS AUSENTES do
  // ║          schema canônico (to_regclass → NULL) → 42P01 → 500 para QUALQUER chamada, desde
  // ║          o gênesis. E as partes cujas tabelas EXISTEM comparavam 'SUCCESS' contra o
  // ║          vocabulário minúsculo selado por CHECK — somariam ZERO em silêncio.
  // ║          🔴 NENHUMA tela consome /reports/financial (grep frontend/src → vazio).
  // ║ EM VEZ:  501 honesto, preHandler PRESERVADO (a lição das 6 rotas do parecer Yala: contenção
  // ║          não remove a proteção). Reabrir = decisão de produto + substrato de repasse real
  // ║          (PORTA-01) — os números de repasse que este relatório promete não podem existir
  // ║          antes da porta abrir. O service segue intacto: sumiu a aresta, não o código.
  // ╚════════════════════════════════════════════════════════════════
  fastify.get('/financial', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (_req, reply) => {
    return reply.status(501).send({
      ok: false,
      code: 'FINANCIAL_REPORT_NOT_WIRED',
      error: 'FINANCIAL_REPORT_NOT_WIRED',
      message:
        'Financial report is not wired. It joins transfer tables that do not exist in the canonical ' +
        'schema, so it answered 500 for every call since the genesis, and no screen consumes it. ' +
        'The transfer figures it promises cannot exist before PORTA-01 opens. No money is moved.',
      money_moved: false,
    });
  });

  // SPRINT 58: GET /reports/inventory/aging
  fastify.get('/inventory/aging', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetStockAgingOptions = {};

    if (query.productVariantId) {
      options.productVariantId = query.productVariantId;
    }

    if (query.minDaysInStock) {
      options.minDaysInStock = parseInt(query.minDaysInStock, 10);
    }

    if (query.maxDaysInStock) {
      options.maxDaysInStock = parseInt(query.maxDaysInStock, 10);
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    const aging = await inventorySlaService.getStockAging(tenantId, options);
    return reply.status(200).send(aging);
  });

  // SPRINT 58: GET /reports/transfers/sla
  fastify.get('/transfers/sla', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetTransferSlaOptions = {};
    const config: SlaConfig = {};

    // 🔴 DECISION-0113 / F-REPORTS-TRANSFERS-SLA-REPRESENTATION — `reports:view_operational` prova acesso ao MÓDULO,
    // NÃO autoridade sobre o actor filtrado. fromActorId/toActorId são HINTs → exigem canRepresentActor (igual às
    // rotas irmãs). Sem filtro de actor → NÃO tenant-wide → escopa ao actor representado (self) como parte (from OU to).
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId) {
      return reply.status(401).send({ ok: false, error: 'Autenticação obrigatória (req.user.userId)' });
    }
    const canRepresent = async (actorId: string): Promise<boolean> => {
      try { return await authorizationService.canRepresentActor(tenantId, userId, actorId); } catch { return false; }
    };
    let actorScoped = false;
    if (query.fromActorId) {
      if (!(await canRepresent(String(query.fromActorId)))) {
        return reply.status(403).send({ ok: false, error: 'Sem autoridade sobre fromActorId (canRepresentActor)', code: 'REPORT_ACTOR_NOT_REPRESENTABLE' });
      }
      options.fromActorId = String(query.fromActorId);
      actorScoped = true;
    }
    if (query.toActorId) {
      if (!(await canRepresent(String(query.toActorId)))) {
        return reply.status(403).send({ ok: false, error: 'Sem autoridade sobre toActorId (canRepresentActor)', code: 'REPORT_ACTOR_NOT_REPRESENTABLE' });
      }
      options.toActorId = String(query.toActorId);
      actorScoped = true;
    }
    if (!actorScoped) {
      const self = await resolveReportActorId(req, reply);
      if (self === null) return; // 401/403/400 já enviado
      options.participantActorId = self;
    }

    if (query.status) {
      options.status = query.status as any;
    }

    if (query.onlyOverdue === 'true') {
      options.onlyOverdue = true;
    }

    if (query.maxDaysShippedToReceiving) {
      options.maxDaysShippedToReceiving = parseInt(query.maxDaysShippedToReceiving, 10);
    }

    if (query.maxDaysReceivingToReceived) {
      options.maxDaysReceivingToReceived = parseInt(query.maxDaysReceivingToReceived, 10);
    }

    // Config padrão (pode vir de env ou config)
    if (query.slaMaxDaysShippedToReceiving) {
      config.maxDaysShippedToReceiving = parseInt(query.slaMaxDaysShippedToReceiving, 10);
    }

    if (query.slaMaxDaysReceivingToReceived) {
      config.maxDaysReceivingToReceived = parseInt(query.slaMaxDaysReceivingToReceived, 10);
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    const sla = await inventorySlaService.getTransferSla(tenantId, options, config);
    return reply.status(200).send(sla);
  });

  // SPRINT 59: GET /reports/inventory/suggestions
  fastify.get('/inventory/suggestions', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetInventorySuggestionsOptions = {};
    const config: SuggestionConfig = {};

    // 🔴 DECISION-0113 / Z2-R3: query.actorId é HINT → representável OU self via actionContext (canRepresentActor).
    // `reports:view_operational` prova acesso ao MÓDULO, NÃO autoridade sobre o actor filtrado. 403 senão.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return; // 401/403/400 já enviado
    options.actorId = authorizedActorId;

    if (query.productVariantId) {
      options.productVariantId = query.productVariantId;
    }

    if (query.suggestionType) {
      options.suggestionType = query.suggestionType as any;
    }

    if (query.minConfidence) {
      options.minConfidence = query.minConfidence as any;
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    // Configurações de thresholds
    if (query.minDaysOfStock) {
      config.minDaysOfStock = parseInt(query.minDaysOfStock, 10);
    }

    if (query.highAgingThreshold) {
      config.highAgingThreshold = parseInt(query.highAgingThreshold, 10);
    }

    if (query.excessStockMultiplier) {
      config.excessStockMultiplier = parseFloat(query.excessStockMultiplier);
    }

    if (query.stockoutRiskThreshold) {
      config.stockoutRiskThreshold = parseInt(query.stockoutRiskThreshold, 10);
    }

    if (query.staleStockThreshold) {
      config.staleStockThreshold = parseInt(query.staleStockThreshold, 10);
    }

    if (query.lowTurnoverThreshold) {
      config.lowTurnoverThreshold = parseFloat(query.lowTurnoverThreshold);
    }

    const suggestions = await inventorySuggestionService.getSuggestions(tenantId, options, config);
    
    // Adicionar explicação detalhada para cada sugestão
    const suggestionsWithExplanation = suggestions.map((suggestion) => ({
      ...suggestion,
      detailedExplanation: inventorySuggestionService.explainSuggestion(suggestion),
    }));

    return reply.status(200).send({
      suggestions: suggestionsWithExplanation,
      totalCents: suggestions.length,
    });
  });

  // SPRINT 60: GET /reports/inventory/holding-costs
  fastify.get('/inventory/holding-costs', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetHoldingCostsOptions = {};
    const config: HoldingCostConfig = {};

    // 🔴 DECISION-0113 / Z2-R3: query.actorId é HINT → representável OU self via actionContext (canRepresentActor).
    // `reports:view_operational` prova acesso ao MÓDULO, NÃO autoridade sobre o actor filtrado. 403 senão.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return; // 401/403/400 já enviado
    options.actorId = authorizedActorId;

    if (query.productVariantId) {
      options.productVariantId = query.productVariantId;
    }

    if (query.minDays) {
      options.minDays = parseInt(query.minDays, 10);
    }

    if (query.minCost) {
      options.minCost = parseFloat(query.minCost);
    }

    if (query.minCostLevel) {
      options.minCostLevel = query.minCostLevel as any;
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    // Configurações de cálculo
    if (query.dailyHoldingRate) {
      config.dailyHoldingRate = parseFloat(query.dailyHoldingRate);
    }

    if (query.lowCostThreshold) {
      config.lowCostThreshold = parseFloat(query.lowCostThreshold);
    }

    if (query.mediumCostThreshold) {
      config.mediumCostThreshold = parseFloat(query.mediumCostThreshold);
    }

    if (query.highCostThreshold) {
      config.highCostThreshold = parseFloat(query.highCostThreshold);
    }

    const holdingCosts = await inventoryHoldingCostService.getHoldingCosts(tenantId, options, config);

    // Calcular totais agregados
    const totalCost = holdingCosts.reduce((sum, cost) => sum + cost.totalHoldingCost, 0);
    const averageCost = holdingCosts.length > 0 ? totalCost / holdingCosts.length : 0;

    return reply.status(200).send({
      holdingCosts,
      summary: {
        totalCost,
        itemCount: holdingCosts.length,
        averageCost,
      },
    });
  });

  // SPRINT 61: GET /reports/margin/variants
  fastify.get('/margin/variants', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetMarginOptions = {
      groupBy: 'variant',
    };
    const config: MarginConfig = {};

    // 🔴 DECISION-0113: query.actorId é HINT → representável OU self via actionContext. Nunca cru/tenant-wide.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return;
    options.actorId = authorizedActorId;

    if (query.productVariantId) {
      options.productVariantId = query.productVariantId;
    }

    if (query.channel) {
      options.channel = query.channel as any;
    }

    if (query.periodStart) {
      options.periodStart = new Date(query.periodStart);
    }

    if (query.periodEnd) {
      options.periodEnd = new Date(query.periodEnd);
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    if (query.includeHoldingCost === 'false') {
      config.includeHoldingCost = false;
    }

    if (query.holdingCostDailyRate) {
      config.holdingCostDailyRate = parseFloat(query.holdingCostDailyRate);
    }

    const margins = await realMarginService.getMarginByVariant(tenantId, options, config);
    return reply.status(200).send(margins);
  });

  // SPRINT 61: GET /reports/margin/actors
  fastify.get('/margin/actors', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetMarginOptions = {
      groupBy: 'actor',
    };
    const config: MarginConfig = {};

    // 🔴 DECISION-0113: query.actorId é HINT → representável OU self via actionContext. Nunca cru/tenant-wide.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return;
    options.actorId = authorizedActorId;

    if (query.channel) {
      options.channel = query.channel as any;
    }

    if (query.periodStart) {
      options.periodStart = new Date(query.periodStart);
    }

    if (query.periodEnd) {
      options.periodEnd = new Date(query.periodEnd);
    }

    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset, 10);
    }

    if (query.includeHoldingCost === 'false') {
      config.includeHoldingCost = false;
    }

    if (query.holdingCostDailyRate) {
      config.holdingCostDailyRate = parseFloat(query.holdingCostDailyRate);
    }

    const margins = await realMarginService.getMarginByActor(tenantId, options, config);
    return reply.status(200).send(margins);
  });

  // SPRINT 61: GET /reports/margin/channels
  fastify.get('/margin/channels', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const options: GetMarginOptions = {
      groupBy: 'channel',
    };
    const config: MarginConfig = {};

    // 🔴 DECISION-0113: query.actorId é HINT → representável OU self via actionContext. Nunca cru/tenant-wide.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return;
    options.actorId = authorizedActorId;

    if (query.periodStart) {
      options.periodStart = new Date(query.periodStart);
    }

    if (query.periodEnd) {
      options.periodEnd = new Date(query.periodEnd);
    }

    if (query.includeHoldingCost === 'false') {
      config.includeHoldingCost = false;
    }

    if (query.holdingCostDailyRate) {
      config.holdingCostDailyRate = parseFloat(query.holdingCostDailyRate);
    }

    const margins = await realMarginService.getMarginByChannel(tenantId, options, config);
    return reply.status(200).send(margins);
  });

  // SPRINT 62: POST /reports/simulations
  fastify.post('/simulations', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const body = req.body as any;

    if (!body.scenarioType) {
      return reply.status(400).send({
        error: 'scenarioType é obrigatório',
      });
    }

    if (!body.parameters) {
      return reply.status(400).send({
        error: 'parameters é obrigatório',
      });
    }

    const input: SimulationInput = {
      scenarioType: body.scenarioType,
      parameters: body.parameters,
    };

    try {
      const result = await decisionSimulationService.simulate(tenantId, input);
      return reply.status(200).send(result);
    } catch (error) {
      req.log.error({ err: error }, 'Erro ao executar simulação');
      return reply.status(500).send({
        error: 'Erro ao executar simulação',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // SPRINT 63: GET /reports/pricing/strategy
  fastify.get('/pricing/strategy', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    if (!query.productVariantId) {
      return reply.status(400).send({
        error: 'productVariantId é obrigatório',
      });
    }

    const options: GetPricingStrategyOptions = {
      productVariantId: query.productVariantId,
    };

    // 🔴 DECISION-0113: query.actorId é HINT → representável OU self via actionContext. Nunca cru/tenant-wide.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return;
    options.actorId = authorizedActorId;

    if (query.channel) {
      options.channel = query.channel as any;
    }

    if (query.priceRangeSteps) {
      options.priceRangeSteps = parseInt(query.priceRangeSteps, 10);
    }

    if (query.simulationPeriodDays) {
      options.simulationPeriodDays = parseInt(query.simulationPeriodDays, 10);
    }

    try {
      const strategy = await pricingStrategyService.getPriceStrategy(tenantId, options);
      return reply.status(200).send(strategy);
    } catch (error) {
      req.log.error({ err: error }, 'Erro ao buscar estratégia de preço');
      return reply.status(500).send({
        error: 'Erro ao buscar estratégia de preço',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });
};

export default reportsRoutes;


