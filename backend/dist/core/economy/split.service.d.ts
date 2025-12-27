import type { SplitConfig, SplitContext, SplitResult } from './split.types';
declare class SplitEngineService {
    /**
     * Obtém configuração padrão de splits para um tenant
     * Lê normas econômicas do Policy Registry (constituição, não configuração)
     * Fallbacks explícitos garantem funcionamento mesmo se policies não existirem
     *
     * 🔴 CRÍTICO: Para contextos EVENT, sempre usa EVENT_ORGANIZER em vez de WORKER
     */
    getDefaultConfigForTenant(tenantId: string, currency?: string, module?: string): SplitConfig;
    /**
     * Calcula os splits sem criar transações
     */
    calculateSplits(context: SplitContext): SplitResult;
    /**
     * Aplica os splits criando transações reais
     */
    applySplits(context: SplitContext): Promise<SplitResult>;
}
export declare const splitEngineService: SplitEngineService;
export {};
//# sourceMappingURL=split.service.d.ts.map