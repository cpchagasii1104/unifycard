export declare class PricingService {
    calculateEstimatedPrice(tenantId: string, requestId: string): Promise<{
        total: number;
        currency: any;
        base_fare: any;
        distance_cost: number;
        dynamic_adjustments: number;
        zone_incentive: number;
        distance_km: number;
    }>;
    calculateFinalPrice(tenantId: string, rideId: string): Promise<{
        total: number;
        currency: any;
        base_fare: any;
        distance_cost: number;
        dynamic_adjustments: number;
        distance_km: number;
    }>;
    calculateRouteDistance(tenantId: string, req: any): Promise<number>;
    calculateRideDistance(tenantId: string, rideId: string): Promise<number>;
    getCityPricingConfig(tenantId: string, serviceTypeId: string): Promise<any>;
    applyDistanceTiers(tenantId: string, cityId: string, distanceKm: number): Promise<number>;
    getDynamicAdjustments(tenantId: string, cityId: string): Promise<number>;
    getZoneIncentive(tenantId: string, originPoint: any): Promise<number>;
    calculateEstimate(tenantId: string, cityId: string, data: {
        origin: {
            lat: number;
            lng: number;
        };
        destination: {
            lat: number;
            lng: number;
        };
        stops?: Array<{
            lat: number;
            lng: number;
        }>;
        passenger_count?: number;
        service_type_id?: string;
    }): Promise<{
        total: number;
        currency: string;
        base_fare: number;
        distance_cost: number;
        dynamic_adjustments: number;
        zone_incentive: number;
        distance_km: number;
    }>;
}
export declare const pricingService: PricingService;
//# sourceMappingURL=pricing.service.d.ts.map