export declare class DriversService {
    createDriver(tenantId: string, userId: string): Promise<any>;
    uploadDriverDocument(tenantId: string, driverId: string, payload: any): Promise<{
        ok: boolean;
    }>;
    approveDriver(tenantId: string, driverId: string): Promise<any>;
    suspendDriver(tenantId: string, driverId: string, reason: string): Promise<any>;
    checkExpiredDocuments(tenantId: string): Promise<number>;
    ensureDriverCanOperate(tenantId: string, driverId: string): Promise<boolean>;
    listDrivers(tenantId: string): Promise<any[]>;
    updateDriver(tenantId: string, driverId: string, patch: any): Promise<any>;
    getDriverByUserId(tenantId: string, userId: string): Promise<any>;
}
export declare const driversService: DriversService;
//# sourceMappingURL=drivers.service.d.ts.map