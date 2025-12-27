/**
 * Resultado de prontidão de cidade
 */
export interface CityReadiness {
    cityId: string;
    regionId: string;
    activeModules: string[];
    missingDependencies: string[];
    economyReady: boolean;
    usersCount: number;
    transactionsLast30Days: number;
    canActivate: {
        work: boolean;
        rides: boolean;
        marketplace: boolean;
        fund: boolean;
    };
    reasons: Record<string, string[]>;
}
//# sourceMappingURL=city-readiness.types.d.ts.map