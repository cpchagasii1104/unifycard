import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
import type { SimulationRules, SimulationResult } from './simulation.types';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';
/**
 * Engine de simulação - função pura e determinística
 * Recebe eventos e regras, retorna resultado
 */
export declare class SimulationEngine {
    /**
     * Simula split regional alternativo
     * Calcula quanto o fundo teria acumulado com percentual diferente
     */
    simulateRegionalSplit(events: CanonicalEvent[], rules: SimulationRules, period: {
        start: string;
        end: string;
    }, context?: PolicyContext): Promise<SimulationResult>;
}
export declare const simulationEngine: SimulationEngine;
//# sourceMappingURL=simulation-engine.d.ts.map