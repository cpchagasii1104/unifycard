// backend/src/modules/reports/reports.routes.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Rotas REST

import type { FastifyInstance } from 'fastify';
import { salesReportService } from './sales-report.service';
import { inventoryReportService } from './inventory-report.service';
import { financialReportService } from './financial-report.service';
import { inventorySlaService } from '../marketplace/inventory-sla.service';
import { inventorySuggestionService } from '../marketplace/inventory-suggestion.service';
import { inventoryHoldingCostService } from '../marketplace/inventory-holding-cost.service';
import { realMarginService } from '../marketplace/real-margin.service';
import { decisionSimulationService } from '../marketplace/decision-simulation.service';
import { pricingStrategyService } from '../marketplace/pricing-strategy.service';
import type { SalesReportFilters } from './sales-report.types';
import type { InventoryReportFilters } from './inventory-report.types';
import type { FinancialReportFilters } from './financial-report.types';
import type { GetStockAgingOptions, GetTransferSlaOptions, SlaConfig } from '../marketplace/inventory-sla.types';
import type { GetInventorySuggestionsOptions, SuggestionConfig } from '../marketplace/inventory-suggestion.types';
import type { GetHoldingCostsOptions, HoldingCostConfig } from '../marketplace/inventory-holding-cost.types';
import type { GetMarginOptions, MarginConfig } from '../marketplace/real-margin.types';
import type { SimulationInput } from '../marketplace/decision-simulation.types';
import type { GetPricingStrategyOptions } from '../marketplace/pricing-strategy.types';

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

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

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
  fastify.get('/financial', {
    preHandler: [fastify.requirePermission(['reports:view_operational'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: FinancialReportFilters = {};

    if (query.startDate) {
      filters.startDate = new Date(query.startDate);
    }

    if (query.endDate) {
      filters.endDate = new Date(query.endDate);
    }

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    const report = await financialReportService.generateReport(tenantId, filters);
    return reply.status(200).send(report);
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

    if (query.fromActorId) {
      options.fromActorId = query.fromActorId;
    }

    if (query.toActorId) {
      options.toActorId = query.toActorId;
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

    if (query.actorId) {
      options.actorId = query.actorId;
    }

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

    if (query.actorId) {
      options.actorId = query.actorId;
    }

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

    if (query.actorId) {
      options.actorId = query.actorId;
    }

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

    if (query.actorId) {
      options.actorId = query.actorId;
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

    if (query.actorId) {
      options.actorId = query.actorId;
    }

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

    if (query.actorId) {
      options.actorId = query.actorId;
    }

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


