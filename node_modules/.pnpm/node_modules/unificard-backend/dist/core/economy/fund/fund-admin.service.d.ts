export interface RegionFundData {
    regionId: string;
    regionName?: string;
    accountId: string;
    balance: number;
    totalAccumulated: number;
    transactionCount: number;
    growth7Days: number;
    growth30Days: number;
    lastTransactionDate?: string;
}
export interface RegionFundExport {
    regionId: string;
    regionName?: string;
    balance: number;
    totalAccumulated: number;
    transactionCount: number;
    growth7Days: number;
    growth30Days: number;
    lastTransactionDate?: string;
    exportDate: string;
}
declare class FundAdminService {
    /**
     * Lista todas as regiões com dados agregados do fundo
     */
    listAllRegions(tenantId: string): Promise<RegionFundData[]>;
    /**
     * Exporta dados do fundo por região (CSV/JSON)
     */
    exportRegionsData(tenantId: string): Promise<RegionFundExport[]>;
}
export declare const fundAdminService: FundAdminService;
export {};
//# sourceMappingURL=fund-admin.service.d.ts.map