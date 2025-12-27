"use strict";
// src/core/policy-resolution/policy-resolution-engine.ts
// Engine de resolução dinâmica de políticas baseado em contexto
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyResolutionEngine = exports.PolicyResolutionEngine = void 0;
const uuid_1 = require("uuid");
const policy_registry_1 = require("../policy/policy-registry");
const decision_log_service_1 = require("../decision-log/decision-log.service");
/**
 * Engine de resolução de políticas
 * Resolve valores de políticas dinamicamente baseado em contexto
 * Read-only - não altera políticas originais
 */
class PolicyResolutionEngine {
    /**
     * Resolve uma política aplicando ajustes baseados no contexto
     */
    async resolvePolicy(domain, key, context = {}) {
        // Validação: políticas de economia requerem cityId (guardrail de cidade)
        if (domain === 'economy' && !context.cityId) {
            // Não falhar silenciosamente - retornar null com motivo explícito
            console.warn('[PolicyResolutionEngine] Política de economia requer cityId no contexto', { domain, key });
            return null;
        }
        // Buscar política original
        const policy = policy_registry_1.policyRegistry.getPolicy(domain, key);
        if (!policy) {
            return null; // Política não encontrada
        }
        // Verificar se é um valor numérico
        if (typeof policy.value !== 'number') {
            // Para valores não numéricos, retornar sem ajustes
            return {
                originalValue: policy.value,
                resolvedValue: policy.value,
                adjustments: [],
                context,
            };
        }
        const originalValue = policy.value;
        let resolvedValue = originalValue;
        const adjustments = [];
        // Aplicar ajustes baseados no contexto
        // 1. Ajuste por região (se especificado)
        if (context.regionId) {
            const regionAdjustment = this.calculateRegionAdjustment(originalValue, context.regionId);
            if (regionAdjustment !== 0) {
                resolvedValue += regionAdjustment;
                adjustments.push({
                    reason: `Ajuste regional para ${context.regionId}`,
                    adjustment: regionAdjustment,
                });
            }
        }
        // 2. Ajuste por módulo (se especificado)
        if (context.module) {
            const moduleAdjustment = this.calculateModuleAdjustment(originalValue, context.module);
            if (moduleAdjustment !== 0) {
                resolvedValue += moduleAdjustment;
                adjustments.push({
                    reason: `Ajuste para módulo ${context.module}`,
                    adjustment: moduleAdjustment,
                });
            }
        }
        // 3. Ajuste por demanda (se especificado)
        if (context.demandIndex !== undefined) {
            const demandAdjustment = this.calculateDemandAdjustment(originalValue, context.demandIndex);
            if (demandAdjustment !== 0) {
                resolvedValue += demandAdjustment;
                adjustments.push({
                    reason: `Ajuste por demanda (índice: ${context.demandIndex})`,
                    adjustment: demandAdjustment,
                });
            }
        }
        // 4. Ajuste por oferta (se especificado)
        if (context.supplyIndex !== undefined) {
            const supplyAdjustment = this.calculateSupplyAdjustment(originalValue, context.supplyIndex);
            if (supplyAdjustment !== 0) {
                resolvedValue += supplyAdjustment;
                adjustments.push({
                    reason: `Ajuste por oferta (índice: ${context.supplyIndex})`,
                    adjustment: supplyAdjustment,
                });
            }
        }
        // 5. Ajuste por taxa de crescimento (se especificado)
        if (context.growthRate !== undefined) {
            const growthAdjustment = this.calculateGrowthAdjustment(originalValue, context.growthRate);
            if (growthAdjustment !== 0) {
                resolvedValue += growthAdjustment;
                adjustments.push({
                    reason: `Ajuste por crescimento (taxa: ${context.growthRate}%)`,
                    adjustment: growthAdjustment,
                });
            }
        }
        // Aplicar limites min/max da política
        const metadata = policy.metadata || {};
        const min = typeof metadata.min === 'number' ? metadata.min : undefined;
        const max = typeof metadata.max === 'number' ? metadata.max : undefined;
        if (min !== undefined && resolvedValue < min) {
            const clamped = min - resolvedValue;
            resolvedValue = min;
            adjustments.push({
                reason: `Aplicado limite mínimo (${min})`,
                adjustment: clamped,
            });
        }
        if (max !== undefined && resolvedValue > max) {
            const clamped = max - resolvedValue;
            resolvedValue = max;
            adjustments.push({
                reason: `Aplicado limite máximo (${max})`,
                adjustment: clamped,
            });
        }
        const resolution = {
            originalValue,
            resolvedValue,
            adjustments,
            context,
        };
        // Registrar observação no decision log (se houver ajustes significativos)
        if (adjustments.length > 0 || context.regionId || context.module) {
            try {
                await decision_log_service_1.decisionLogService.createObservation(domain, // economy | fund | work | rides
                key, {
                    regionId: context.regionId,
                    module: context.module,
                    demandIndex: context.demandIndex,
                    supplyIndex: context.supplyIndex,
                    growthRate: context.growthRate,
                    ...context.metadata,
                }, originalValue, {
                    suggestedValue: resolvedValue,
                    metadata: {
                        adjustments: adjustments.map((a) => ({
                            reason: a.reason,
                            adjustment: a.adjustment,
                        })),
                        resolutionId: (0, uuid_1.v4)(),
                    },
                });
            }
            catch (error) {
                // Continuar mesmo se falhar (modo read-only)
                console.warn('[PolicyResolutionEngine] Erro ao registrar observação:', error);
            }
        }
        return resolution;
    }
    /**
     * Calcula ajuste baseado em região
     * Por enquanto, ajuste simples baseado em hash da região
     * Futuramente pode usar dados reais de performance por região
     */
    calculateRegionAdjustment(baseValue, regionId) {
        // Ajuste simples: variação de -5% a +5% baseado em hash da região
        // Isso é apenas para demonstração - em produção usaria dados reais
        const hash = this.simpleHash(regionId);
        const variation = (hash % 11 - 5) / 100; // -5% a +5%
        return baseValue * variation;
    }
    /**
     * Calcula ajuste baseado em módulo
     * TEMPORARY_HEURISTIC: Multiplicadores por módulo são heurísticas temporárias.
     * Futuramente serão substituídos por dados reais de performance ou políticas dinâmicas.
     */
    calculateModuleAdjustment(baseValue, module) {
        // TEMPORARY_HEURISTIC: Ajustes por módulo (exemplos)
        const moduleMultipliers = {
            work: 1.0, // Sem ajuste
            rides: 0.95, // -5%
            events: 1.05, // +5%
            commerce: 1.0,
            other: 1.0,
        };
        const multiplier = moduleMultipliers[module || 'other'] || 1.0;
        return baseValue * (multiplier - 1.0);
    }
    /**
     * Calcula ajuste baseado em demanda
     * Alta demanda = aumento, baixa demanda = redução
     */
    calculateDemandAdjustment(baseValue, demandIndex) {
        // Normalizar demanda para 0-1 se necessário
        const normalized = Math.max(0, Math.min(1, demandIndex));
        // Ajuste: -10% (demanda baixa) a +10% (demanda alta)
        const variation = (normalized - 0.5) * 0.2; // -0.1 a +0.1
        return baseValue * variation;
    }
    /**
     * Calcula ajuste baseado em oferta
     * Alta oferta = redução, baixa oferta = aumento
     */
    calculateSupplyAdjustment(baseValue, supplyIndex) {
        // Normalizar oferta para 0-1 se necessário
        const normalized = Math.max(0, Math.min(1, supplyIndex));
        // Ajuste: +10% (oferta baixa) a -10% (oferta alta)
        const variation = (0.5 - normalized) * 0.2; // +0.1 a -0.1
        return baseValue * variation;
    }
    /**
     * Calcula ajuste baseado em taxa de crescimento
     * Alto crescimento = aumento, baixo crescimento = redução
     */
    calculateGrowthAdjustment(baseValue, growthRate) {
        // Ajuste: -5% (crescimento negativo) a +5% (crescimento alto)
        // Crescimento >20% = +5%, crescimento <0% = -5%
        const normalized = Math.max(-1, Math.min(1, growthRate / 20)); // Normalizar para -1 a 1
        // TEMPORARY_HEURISTIC: Variação de crescimento fixa (5%)
        // Futuramente será substituída por dados reais de crescimento por cidade/região
        const variation = normalized * 0.05; // -0.05 a +0.05
        return baseValue * variation;
    }
    /**
     * Hash simples para gerar variação determinística baseada em string
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
}
exports.PolicyResolutionEngine = PolicyResolutionEngine;
exports.policyResolutionEngine = new PolicyResolutionEngine();
//# sourceMappingURL=policy-resolution-engine.js.map