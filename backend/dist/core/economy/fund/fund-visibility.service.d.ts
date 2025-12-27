import type { RegionalFundSummary, RegionalFundHistory, RegionalFundProjection, RegionalFundView } from './fund.types';
declare class FundVisibilityService {
    /**
     * Obtém resumo do Fundo Regional com DTO claro
     */
    getSummary(tenantId: string): Promise<RegionalFundSummary>;
    /**
     * Obtém histórico do Fundo Regional com DTO claro
     */
    getHistory(tenantId: string, rangeDays?: number): Promise<RegionalFundHistory>;
    /**
     * Obtém projeção do Fundo Regional baseada em insights
     */
    getProjection(tenantId: string): Promise<RegionalFundProjection>;
    /**
     * Obtém visão completa do Fundo Regional
     * Combina resumo, histórico e projeção
     */
    getCompleteView(tenantId: string, historyDays?: number): Promise<RegionalFundView>;
}
export declare const fundVisibilityService: FundVisibilityService;
export {};
//# sourceMappingURL=fund-visibility.service.d.ts.map