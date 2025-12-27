"use strict";
// src/core/simulation/simulation-engine.ts
// Engine de simulação - função pura e determinística
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulationEngine = exports.SimulationEngine = void 0;
const uuid_1 = require("uuid");
const policy_registry_1 = require("../policy/policy-registry");
const policy_resolution_engine_1 = require("../policy-resolution/policy-resolution-engine");
const decision_log_service_1 = require("../decision-log/decision-log.service");
/**
 * Engine de simulação - função pura e determinística
 * Recebe eventos e regras, retorna resultado
 */
class SimulationEngine {
    /**
     * Simula split regional alternativo
     * Calcula quanto o fundo teria acumulado com percentual diferente
     */
    async simulateRegionalSplit(events, rules, period, context) {
        // Resolver política com contexto (se fornecido)
        let actualPercentage;
        if (context) {
            const resolution = await policy_resolution_engine_1.policyResolutionEngine.resolvePolicy('economy', 'regional_split_percentage', context);
            actualPercentage = resolution?.resolvedValue || 0.10;
        }
        else {
            // Fallback para política estática
            actualPercentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'regional_split_percentage', 0.10) || 0.10;
        }
        // Filtrar apenas eventos de pagamento processado
        const paymentEvents = events.filter((e) => e.eventType === 'payment.processed' && e.amount !== undefined);
        // Calcular valor atual (lê da policy)
        const actualValue = paymentEvents.reduce((sum, event) => {
            const amount = event.amount || 0;
            const regionalSplit = amount * actualPercentage;
            return sum + regionalSplit;
        }, 0);
        // Calcular valor simulado (percentual alternativo)
        // Se não fornecido nas regras, usar policy de simulação ou fallback explícito
        const simulatedPercentage = rules.regionalSplitPercentage ||
            policy_registry_1.policyRegistry.getPolicyValue('simulation', 'alternative_regional_split_percentage', 0.15 // Fallback explícito: 15% como valor padrão de simulação
            ) || 0.15;
        const simulatedValue = paymentEvents.reduce((sum, event) => {
            const amount = event.amount || 0;
            const regionalSplit = amount * simulatedPercentage;
            return sum + regionalSplit;
        }, 0);
        // Calcular delta e percentual de mudança
        const delta = simulatedValue - actualValue;
        const percentageChange = actualValue > 0 ? (delta / actualValue) * 100 : 0;
        const result = {
            simulationId: (0, uuid_1.v4)(),
            simulationType: 'regional_split_alternative',
            rules,
            actualValue,
            simulatedValue,
            delta,
            percentageChange,
            eventCount: paymentEvents.length,
            period,
            metadata: {
                originalPercentage: actualPercentage,
                simulatedPercentage,
                currency: paymentEvents[0]?.currency || 'BRL',
            },
        };
        // Registrar observação no decision log
        try {
            await decision_log_service_1.decisionLogService.createObservation('economy', 'regional_split_percentage', (context || {}), actualPercentage, {
                suggestedValue: simulatedPercentage,
                metadata: {
                    simulationId: result.simulationId,
                    simulationType: result.simulationType,
                    actualValue: result.actualValue,
                    simulatedValue: result.simulatedValue,
                    delta: result.delta,
                    percentageChange: result.percentageChange,
                    eventCount: result.eventCount,
                    period: result.period,
                },
            });
        }
        catch (error) {
            // Continuar mesmo se falhar (modo read-only)
            console.warn('[SimulationEngine] Erro ao registrar observação:', error);
        }
        return result;
    }
}
exports.SimulationEngine = SimulationEngine;
exports.simulationEngine = new SimulationEngine();
//# sourceMappingURL=simulation-engine.js.map