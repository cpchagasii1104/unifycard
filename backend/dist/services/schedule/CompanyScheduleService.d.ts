interface BusinessHours {
    monday?: {
        start: string;
        end: string;
    };
    tuesday?: {
        start: string;
        end: string;
    };
    wednesday?: {
        start: string;
        end: string;
    };
    thursday?: {
        start: string;
        end: string;
    };
    friday?: {
        start: string;
        end: string;
    };
    saturday?: {
        start: string;
        end: string;
    };
    sunday?: {
        start: string;
        end: string;
    };
}
export declare class CompanyScheduleService {
    /**
     * Cria ou atualiza agenda da empresa
     */
    ensureCompanySchedule(params: {
        companyId: string;
        tenantId: string;
        timezone: string;
        businessHours: BusinessHours;
    }): Promise<string>;
}
export {};
//# sourceMappingURL=CompanyScheduleService.d.ts.map