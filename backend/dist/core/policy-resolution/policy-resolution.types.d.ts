/**
 * Módulos do sistema
 */
export type PolicyModule = 'work' | 'rides' | 'events' | 'commerce' | 'other';
/**
 * Contexto para resolução de políticas
 */
export interface PolicyContext {
    cityId?: string;
    regionId?: string;
    module?: PolicyModule;
    demandIndex?: number;
    supplyIndex?: number;
    growthRate?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Resultado da resolução de uma política
 */
export interface PolicyResolution {
    originalValue: number;
    resolvedValue: number;
    adjustments: Array<{
        reason: string;
        adjustment: number;
    }>;
    context: PolicyContext;
}
//# sourceMappingURL=policy-resolution.types.d.ts.map