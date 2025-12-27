import type { PolicyDomain } from '../policy/policy.types';
import type { PolicyContext, PolicyResolution } from './policy-resolution.types';
/**
 * Engine de resolução de políticas
 * Resolve valores de políticas dinamicamente baseado em contexto
 * Read-only - não altera políticas originais
 */
export declare class PolicyResolutionEngine {
    /**
     * Resolve uma política aplicando ajustes baseados no contexto
     */
    resolvePolicy(domain: PolicyDomain, key: string, context?: PolicyContext): Promise<PolicyResolution | null>;
    /**
     * Calcula ajuste baseado em região
     * Por enquanto, ajuste simples baseado em hash da região
     * Futuramente pode usar dados reais de performance por região
     */
    private calculateRegionAdjustment;
    /**
     * Calcula ajuste baseado em módulo
     * TEMPORARY_HEURISTIC: Multiplicadores por módulo são heurísticas temporárias.
     * Futuramente serão substituídos por dados reais de performance ou políticas dinâmicas.
     */
    private calculateModuleAdjustment;
    /**
     * Calcula ajuste baseado em demanda
     * Alta demanda = aumento, baixa demanda = redução
     */
    private calculateDemandAdjustment;
    /**
     * Calcula ajuste baseado em oferta
     * Alta oferta = redução, baixa oferta = aumento
     */
    private calculateSupplyAdjustment;
    /**
     * Calcula ajuste baseado em taxa de crescimento
     * Alto crescimento = aumento, baixo crescimento = redução
     */
    private calculateGrowthAdjustment;
    /**
     * Hash simples para gerar variação determinística baseada em string
     */
    private simpleHash;
}
export declare const policyResolutionEngine: PolicyResolutionEngine;
//# sourceMappingURL=policy-resolution-engine.d.ts.map