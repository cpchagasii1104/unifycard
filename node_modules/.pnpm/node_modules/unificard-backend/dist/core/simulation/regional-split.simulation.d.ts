import type { SimulationResult } from './simulation.types';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';
/**
 * Executa simulação: "Se split REGIONAL fosse 15% ao invés do valor atual,
 * quanto o fundo teria acumulado nos últimos 30 dias?"
 */
export declare function simulateRegionalSplit15Percent(tenantId: string, days?: number, context?: PolicyContext): Promise<SimulationResult>;
//# sourceMappingURL=regional-split.simulation.d.ts.map