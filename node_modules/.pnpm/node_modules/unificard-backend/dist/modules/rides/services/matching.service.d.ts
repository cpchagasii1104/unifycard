export interface DriverCandidate {
    driver_id: string;
    distance_km: number;
    rating_avg: number;
    can_drive: boolean;
}
export interface MatchingInput {
    tenantId: string;
    lat: number;
    lng: number;
    radiusKm?: number;
    serviceTypeId?: string;
    minCapacity?: number;
    limit?: number;
}
declare class MatchingService {
    findDrivers(input: MatchingInput): Promise<DriverCandidate[]>;
    pickBestDriver(input: MatchingInput): Promise<DriverCandidate>;
}
export declare const matchingService: MatchingService;
export {};
//# sourceMappingURL=matching.service.d.ts.map