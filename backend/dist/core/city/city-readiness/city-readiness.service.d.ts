import type { CityReadiness } from './city-readiness.types';
/**
 * Serviço de prontidão de cidade
 * READ-ONLY: apenas verifica e diagnostica, não executa nada
 */
declare class CityReadinessService {
    /**
     * Obtém prontidão de uma cidade
     * READ-ONLY: não executa, não decide, apenas diagnostica
     */
    getCityReadiness(cityId: string): Promise<CityReadiness | null>;
    /**
     * Obtém dados básicos da cidade
     */
    private getCityData;
    /**
     * Detecta módulos ativos na cidade
     */
    private detectActiveModules;
    /**
     * Detecta dependências faltantes
     */
    private detectMissingDependencies;
    /**
     * Verifica se economia está pronta
     */
    private checkEconomyReady;
    /**
     * Obtém contagem de usuários
     */
    private getUsersCount;
    /**
     * Obtém transações dos últimos 30 dias
     */
    private getTransactionsLast30Days;
    /**
     * Verifica se pode ativar WORK
     */
    private canActivateWork;
    /**
     * Verifica se pode ativar RIDES
     */
    private canActivateRides;
    /**
     * Verifica se pode ativar MARKETPLACE
     */
    private canActivateMarketplace;
    /**
     * Verifica se pode ativar FUND
     */
    private canActivateFund;
    /**
     * Obtém motivos de bloqueio para WORK
     */
    private getWorkBlockers;
    /**
     * Obtém motivos de bloqueio para RIDES
     */
    private getRidesBlockers;
    /**
     * Obtém motivos de bloqueio para MARKETPLACE
     */
    private getMarketplaceBlockers;
    /**
     * Obtém motivos de bloqueio para FUND
     */
    private getFundBlockers;
    /**
     * Log estruturado para diagnóstico
     */
    private logReadinessCheck;
}
export declare const cityReadinessService: CityReadinessService;
export {};
//# sourceMappingURL=city-readiness.service.d.ts.map