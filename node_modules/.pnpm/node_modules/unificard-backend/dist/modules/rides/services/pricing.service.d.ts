export interface PricingInput {
    tenantId: string;
    rideId?: string;
    distanceKm: number;
    durationMinutes: number;
    waitTimeSeconds?: number;
    serviceTypeId?: string;
    tipAmount?: number;
}
export interface PricingResult {
    total: number;
    baseFare: number;
    distanceCost: number;
    timeCost: number;
    minimumFare: number;
    surgeMultiplier: number;
    incentiveAmount: number;
    platformFeePercent: number;
    communityFeePercent: number;
    finalFareBeforeTip: number;
}
declare class PricingService {
    getActiveConfig(tenantId: string): Promise<any>;
    getSurgeMultiplier(tenantId: string, lat: number, lng: number): Promise<any>;
    getActiveIncentives(tenantId: string, lat: number, lng: number): Promise<any>;
    calculate(input: PricingInput): Promise<PricingResult>;
}
export declare const pricingService: PricingService;
export {};
//# sourceMappingURL=pricing.service.d.ts.map