export declare class ServiceTypesService {
    createServiceType(tenantId: string, data: any): Promise<any>;
    updateServiceType(tenantId: string, serviceTypeId: string, patch: any): Promise<any>;
    listServiceTypes(tenantId: string): Promise<any[]>;
    getServiceType(tenantId: string, serviceTypeId: string): Promise<any>;
    deleteServiceType(tenantId: string, serviceTypeId: string): Promise<{
        ok: boolean;
    }>;
}
export declare const serviceTypesService: ServiceTypesService;
//# sourceMappingURL=service-types.service.d.ts.map