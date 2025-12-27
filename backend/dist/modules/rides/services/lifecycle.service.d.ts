declare class LifecycleService {
    createRequest(tenantId: string, passengerId: string, data: any): Promise<any>;
    assignDriver(tenantId: string, data: any): Promise<any>;
    startRide(tenantId: string, rideId: string, driverUserId: string): Promise<any>;
    completeRide(tenantId: string, driverUserId: string, data: any): Promise<any>;
}
export declare const lifecycleService: LifecycleService;
export {};
//# sourceMappingURL=lifecycle.service.d.ts.map