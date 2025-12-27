export declare class LocationService {
    updateDriverLocation(tenantId: string, driverId: string, lat: number, lng: number): Promise<{
        ok: boolean;
        error: string;
        limit: {
            can_drive: boolean;
            reason?: string;
            forced_break_until?: string | null;
        };
        zone?: undefined;
        city?: undefined;
        earnings?: undefined;
        suggestions?: undefined;
    } | {
        ok: boolean;
        zone: {
            zone_id: string;
            name: string;
            city_id: string;
        } | undefined;
        city: {
            city_id: string;
            name: string;
        } | undefined;
        earnings: any;
        suggestions: any[] | null;
        limit: {
            can_drive: boolean;
            reason?: string;
            forced_break_until?: string | null;
        };
        error?: undefined;
    }>;
    getDriverLocation(tenantId: string, driverId: string): Promise<{
        lat: number;
        lng: number;
        updated_at: Date;
    }>;
    updateLocation(input: {
        tenantId: string;
        driverId: string;
        lat: number;
        lng: number;
    }): Promise<{
        ok: boolean;
        error: string;
        limit: {
            can_drive: boolean;
            reason?: string;
            forced_break_until?: string | null;
        };
        zone?: undefined;
        city?: undefined;
        earnings?: undefined;
        suggestions?: undefined;
    } | {
        ok: boolean;
        zone: {
            zone_id: string;
            name: string;
            city_id: string;
        } | undefined;
        city: {
            city_id: string;
            name: string;
        } | undefined;
        earnings: any;
        suggestions: any[] | null;
        limit: {
            can_drive: boolean;
            reason?: string;
            forced_break_until?: string | null;
        };
        error?: undefined;
    }>;
    calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): Promise<number>;
    calculateETASeconds(distanceMeters: number): Promise<number>;
}
export declare const locationService: LocationService;
//# sourceMappingURL=location.service.d.ts.map