"use strict";
// src/core/catalog/dynamic-pricing/dynamic-pricing.service.ts
// Serviço de simulação de preço dinâmico - READ-ONLY
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicPricingService = void 0;
const pool_1 = require("../../database/pool");
const decision_log_service_1 = require("../../decision-log/decision-log.service");
const product_demand_service_1 = require("../product-demand/product-demand.service");
const city_readiness_service_1 = require("../../city/city-readiness/city-readiness.service");
/**
 * Serviço de simulação de preço dinâmico
 * READ-ONLY: apenas simula, não executa mudanças de preço
 */
class DynamicPricingService {
    /**
     * Simula preços dinâmicos para todos os produtos de uma cidade
     */
    async simulateCityDynamicPricing(tenantId, cityId) {
        // Guardrail informativo: verificar readiness (não bloqueia, apenas avisa)
        try {
            const readiness = await city_readiness_service_1.cityReadinessService.getCityReadiness(cityId);
            if (readiness && !readiness.canActivate.marketplace) {
                console.warn(`[DynamicPricingService] Cidade ${cityId} não está pronta para marketplace:`, readiness.reasons.marketplace || ['Dependências faltantes']);
            }
        }
        catch (error) {
            // Não falhar silenciosamente - log o erro mas continua
            console.warn('[DynamicPricingService] Erro ao verificar city readiness:', error);
        }
        // Obter sinais de demanda da cidade
        const demandSignals = await product_demand_service_1.productDemandService.getCityDemandSignals(tenantId, cityId);
        if (!demandSignals || demandSignals.signals.length === 0) {
            return null;
        }
        const simulations = [];
        for (const signal of demandSignals.signals) {
            const simulation = await this.simulateProductPricing(tenantId, cityId, signal.productId, signal);
            if (simulation) {
                simulations.push(simulation);
            }
        }
        // Calcular estatísticas (apenas simulações com dados suficientes)
        const validSimulations = simulations.filter((s) => s.simulatedPrice !== null && s.priceChange !== null);
        const productsWithPriceIncrease = validSimulations.filter((s) => s.priceChange > 0).length;
        const productsWithPriceDecrease = validSimulations.filter((s) => s.priceChange < 0).length;
        const totalPriceImpact = validSimulations.reduce((sum, s) => sum + Math.abs(s.priceChange), 0);
        const result = {
            cityId,
            simulations,
            totalProducts: simulations.length,
            productsWithPriceIncrease,
            productsWithPriceDecrease,
            totalPriceImpact,
            computedAt: new Date().toISOString(),
        };
        // Log estruturado (observação)
        await this.logPricingSimulation(tenantId, cityId, result);
        return result;
    }
    /**
     * Simula preço dinâmico para um produto específico
     */
    async simulateProductPricing(tenantId, cityId, productId, demandSignal) {
        // Obter sinal de demanda se não fornecido
        let signal = demandSignal;
        if (!signal) {
            const demandSignalResult = await product_demand_service_1.productDemandService.getProductDemandSignal(tenantId, cityId, productId);
            if (!demandSignalResult) {
                return null;
            }
            signal = demandSignalResult;
        }
        // Obter preço médio atual das ofertas do produto na cidade
        const currentPrice = await this.getAveragePrice(tenantId, cityId, productId);
        if (!currentPrice || currentPrice === 0) {
            return null; // Sem ofertas ativas, não há preço para simular
        }
        // Blindagem semântica: validar confidence antes de calcular
        const signalConfidence = signal.confidence || 'insufficient';
        let simulatedPrice = null;
        let priceChange = null;
        let priceChangePercent = null;
        let adjustmentReason;
        let simulationConfidence;
        if (signalConfidence === 'insufficient') {
            // Dados insuficientes: não calcular simulação
            adjustmentReason = `Dados insuficientes para simulação confiável${signal.reason ? `: ${signal.reason}` : ''}`;
            simulationConfidence = 'insufficient';
        }
        else {
            // Calcular preço simulado baseado em demanda/oferta
            simulatedPrice = this.calculateDynamicPrice(currentPrice, signal.demandIndex, signal.supplyIndex, signal.demandSupplyRatio);
            priceChange = simulatedPrice - currentPrice;
            priceChangePercent =
                currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;
            // Determinar motivo do ajuste
            const baseReason = this.getAdjustmentReason(signal.demandSupplyRatio, priceChangePercent);
            // Adicionar aviso de baixa confiança se necessário
            if (signalConfidence === 'low') {
                adjustmentReason = `[Baixa confiança] ${baseReason}`;
                simulationConfidence = 'low';
            }
            else {
                adjustmentReason = baseReason;
                simulationConfidence = signalConfidence;
            }
        }
        const simulation = {
            productId,
            cityId,
            currentPrice,
            simulatedPrice,
            priceChange,
            priceChangePercent,
            demandIndex: signal.demandIndex,
            supplyIndex: signal.supplyIndex,
            demandSupplyRatio: signal.demandSupplyRatio,
            adjustmentReason,
            computedAt: new Date().toISOString(),
            simulationConfidence,
        };
        // Log estruturado (observação)
        await this.logProductPricing(tenantId, cityId, productId, simulation);
        return simulation;
    }
    /**
     * Obtém preço médio atual das ofertas do produto na cidade
     */
    async getAveragePrice(tenantId, cityId, productId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT price
        FROM product_offers
        WHERE tenant_id = $1
          AND product_id = $2
          AND location_city_id = $3
          AND active = TRUE
        `,
            values: [tenantId, productId, cityId],
        });
        if (rows.length === 0) {
            return null;
        }
        const total = rows.reduce((sum, row) => sum + parseFloat(row.price), 0);
        return total / rows.length;
    }
    /**
     * Calcula preço dinâmico simulado
     * Baseado em demanda vs oferta
     */
    calculateDynamicPrice(currentPrice, demandIndex, supplyIndex, demandSupplyRatio) {
        // Se demanda > oferta (ratio > 1), aumentar preço
        // Se oferta > demanda (ratio < 1), diminuir preço
        // Ajuste máximo: ±20% do preço atual
        let adjustmentFactor = 1.0;
        if (demandSupplyRatio > 1.0) {
            // Alta demanda: aumentar preço
            // Ratio 1.0 = 0%, Ratio 2.0 = 10%, Ratio 3.0+ = 20% (máximo)
            const excessDemand = Math.min(demandSupplyRatio - 1.0, 2.0); // Cap em 2.0
            adjustmentFactor = 1.0 + excessDemand * 0.1; // 10% por unidade de excesso
            adjustmentFactor = Math.min(adjustmentFactor, 1.2); // Máximo 20%
        }
        else if (demandSupplyRatio < 1.0 && demandSupplyRatio > 0) {
            // Alta oferta: diminuir preço
            // Ratio 0.5 = -10%, Ratio 0.0 = -20% (máximo)
            const excessSupply = 1.0 - demandSupplyRatio;
            adjustmentFactor = 1.0 - excessSupply * 0.2; // 20% por unidade de excesso
            adjustmentFactor = Math.max(adjustmentFactor, 0.8); // Mínimo -20%
        }
        // Se ratio = 1.0 ou 0, manter preço (adjustmentFactor = 1.0)
        return currentPrice * adjustmentFactor;
    }
    /**
     * Determina motivo do ajuste de preço
     */
    getAdjustmentReason(demandSupplyRatio, priceChangePercent) {
        if (priceChangePercent > 5) {
            return `Alta demanda (ratio ${demandSupplyRatio.toFixed(2)}) - aumento de ${priceChangePercent.toFixed(1)}%`;
        }
        else if (priceChangePercent < -5) {
            return `Alta oferta (ratio ${demandSupplyRatio.toFixed(2)}) - redução de ${Math.abs(priceChangePercent).toFixed(1)}%`;
        }
        else if (priceChangePercent > 0) {
            return `Demanda moderadamente alta (ratio ${demandSupplyRatio.toFixed(2)}) - aumento de ${priceChangePercent.toFixed(1)}%`;
        }
        else if (priceChangePercent < 0) {
            return `Oferta moderadamente alta (ratio ${demandSupplyRatio.toFixed(2)}) - redução de ${Math.abs(priceChangePercent).toFixed(1)}%`;
        }
        else {
            return `Equilíbrio demanda/oferta (ratio ${demandSupplyRatio.toFixed(2)}) - sem ajuste`;
        }
    }
    /**
     * Log estruturado de simulação de preço por cidade
     */
    async logPricingSimulation(tenantId, cityId, result) {
        // Log estruturado no console
        console.log(JSON.stringify({
            module: 'dynamic-pricing',
            eventType: 'pricing_simulation',
            tenantId,
            cityId,
            totalProducts: result.totalProducts,
            productsWithPriceIncrease: result.productsWithPriceIncrease,
            productsWithPriceDecrease: result.productsWithPriceDecrease,
            totalPriceImpact: result.totalPriceImpact,
            computedAt: result.computedAt,
            timestamp: new Date().toISOString(),
        }));
        // Registrar no Decision Log (observação)
        try {
            await decision_log_service_1.decisionLogService.createObservation('economy', 'dynamic_pricing_simulation', {
                cityId,
            }, 0, {
                metadata: {
                    totalProducts: result.totalProducts,
                    productsWithPriceIncrease: result.productsWithPriceIncrease,
                    productsWithPriceDecrease: result.productsWithPriceDecrease,
                    totalPriceImpact: result.totalPriceImpact,
                    simulations: result.simulations.map((s) => ({
                        productId: s.productId,
                        currentPrice: s.currentPrice,
                        simulatedPrice: s.simulatedPrice,
                        priceChangePercent: s.priceChangePercent,
                        demandSupplyRatio: s.demandSupplyRatio,
                        adjustmentReason: s.adjustmentReason,
                        // Blindagem semântica: qualidade da simulação
                        simulationConfidence: s.simulationConfidence,
                        isSimulation: true, // Marca explícita: nunca executar automaticamente
                    })),
                },
            });
        }
        catch (error) {
            // Não falhar silenciosamente - log o erro
            console.error('[DynamicPricingService] Erro ao registrar no Decision Log:', error);
        }
    }
    /**
     * Log estruturado de preço por produto
     */
    async logProductPricing(tenantId, cityId, productId, simulation) {
        // Log estruturado no console
        console.log(JSON.stringify({
            module: 'dynamic-pricing',
            eventType: 'product_pricing_simulation',
            tenantId,
            cityId,
            productId,
            currentPrice: simulation.currentPrice,
            simulatedPrice: simulation.simulatedPrice,
            priceChange: simulation.priceChange,
            priceChangePercent: simulation.priceChangePercent,
            demandSupplyRatio: simulation.demandSupplyRatio,
            adjustmentReason: simulation.adjustmentReason,
            computedAt: simulation.computedAt,
            timestamp: new Date().toISOString(),
        }));
        // Registrar no Decision Log (observação)
        try {
            await decision_log_service_1.decisionLogService.createObservation('economy', 'product_dynamic_pricing', {
                cityId,
            }, simulation.currentPrice, {
                suggestedValue: simulation.simulatedPrice ?? undefined,
                metadata: {
                    productId,
                    priceChange: simulation.priceChange,
                    priceChangePercent: simulation.priceChangePercent,
                    demandIndex: simulation.demandIndex,
                    supplyIndex: simulation.supplyIndex,
                    demandSupplyRatio: simulation.demandSupplyRatio,
                    adjustmentReason: simulation.adjustmentReason,
                    // Blindagem semântica: qualidade da simulação
                    simulationConfidence: simulation.simulationConfidence,
                    isSimulation: true, // Marca explícita: nunca executar automaticamente
                },
            });
        }
        catch (error) {
            // Não falhar silenciosamente - log o erro
            console.error('[DynamicPricingService] Erro ao registrar no Decision Log:', error);
        }
    }
}
exports.dynamicPricingService = new DynamicPricingService();
//# sourceMappingURL=dynamic-pricing.service.js.map