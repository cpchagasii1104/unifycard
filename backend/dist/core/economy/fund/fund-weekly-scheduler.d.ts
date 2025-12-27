declare class FundWeeklyScheduler {
    private intervalId;
    private isRunning;
    private lastRunWeek;
    /**
     * Inicia o scheduler semanal
     * Verifica a cada 24 horas se precisa gerar novo relatório
     */
    start(): void;
    /**
     * Para o scheduler
     */
    stop(): void;
    /**
     * Verifica se precisa gerar novo relatório e gera se necessário
     */
    private checkAndGenerate;
    /**
     * Calcula número da semana ISO (YYYY-WW)
     */
    private getWeekNumber;
    /**
     * Força geração de relatório (útil para testes)
     */
    forceGenerate(tenantId: string): Promise<void>;
}
export declare const fundWeeklyScheduler: FundWeeklyScheduler;
export {};
//# sourceMappingURL=fund-weekly-scheduler.d.ts.map