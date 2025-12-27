export declare class RideRequestsService {
    createRequest(tenantId: string, passengerId: string, data: any): Promise<{
        ok: boolean;
        request: any;
        drivers: any[];
        estimated_price: {
            total: number;
            currency: string;
            base_fare: number;
            distance_cost: number;
            dynamic_adjustments: number;
            zone_incentive: number;
            distance_km: number;
        };
    }>;
    findDriversForRequest(tenantId: string, request: any, passengerCount: number, serviceTypeId: string): Promise<any[]>;
    driverAccept(tenantId: string, driverId: string, requestId: string): Promise<any>;
    cancelRequest(tenantId: string, requestId: string, userId: string): Promise<{
        ok: boolean;
    }>;
}
export declare const rideRequestsService: RideRequestsService;
//# sourceMappingURL=ride-requests.service.d.ts.map