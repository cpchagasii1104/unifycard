import type { Insight } from './insight.types';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';
/**
 * Serviço de insights
 * Coordena busca de dados e geração de insights
 */
declare class InsightService {
    /**
     * Gera insights para um tenant e período
     * Opcionalmente pode receber contexto para resolução dinâmica de políticas
     */
    generateInsightsForPeriod(tenantId: string, days?: number, context?: PolicyContext): Promise<Insight[]>;
    /**
     * Gera insights focados em um domínio específico
     */
    generateInsightsByDomain(tenantId: string, domain: Insight['domain'], days?: number): Promise<Insight[]>;
}
export declare const insightService: InsightService;
export {};
//# sourceMappingURL=insight.service.d.ts.map