"use strict";
// src/core/simulation/regional-split.simulation.ts
// Simulação específica: "Se split REGIONAL fosse 15% ao invés de 10%"
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateRegionalSplit15Percent = simulateRegionalSplit15Percent;
const event_log_source_1 = require("./event-log.source");
const simulation_engine_1 = require("./simulation-engine");
const policy_registry_1 = require("../policy/policy-registry");
/**
 * Executa simulação: "Se split REGIONAL fosse 15% ao invés do valor atual,
 * quanto o fundo teria acumulado nos últimos 30 dias?"
 */
async function simulateRegionalSplit15Percent(tenantId, days = 30, context) {
    // Verificar se simulações são permitidas (policy)
    const simulationAllowed = policy_registry_1.policyRegistry.getPolicyValue('simulation', 'allowed', true);
    if (!simulationAllowed) {
        throw new Error('Simulações não são permitidas pela política atual');
    }
    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    // Buscar eventos do período
    const events = await event_log_source_1.eventLogSource.listEvents({
        tenantId,
        sourceModule: 'work',
        eventType: 'work.assignment.paid',
        startDate,
        endDate,
    });
    // Executar simulação (com contexto opcional para resolução dinâmica)
    // Ler percentual alternativo do Policy Registry ou usar fallback explícito
    const alternativePercentage = policy_registry_1.policyRegistry.getPolicyValue('simulation', 'alternative_regional_split_percentage', 0.15 // Fallback explícito: 15% como valor padrão de simulação
    ) || 0.15;
    const result = await simulation_engine_1.simulationEngine.simulateRegionalSplit(events, {
        regionalSplitPercentage: alternativePercentage,
    }, {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
    }, context // Contexto para resolução dinâmica de políticas
    );
    return result;
}
//# sourceMappingURL=regional-split.simulation.js.map