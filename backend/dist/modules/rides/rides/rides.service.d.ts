interface RideRow {
    ride_id: string;
    tenant_id: string;
    request_id: string;
    passenger_user_id: string;
    driver_id: string;
    service_type_id: string;
    passenger_count: number;
    origin: any;
    destination: any;
    stops: any;
    status: string;
    final_price?: number;
    driver_arrived_at?: Date;
    started_at?: Date;
    completed_at?: Date;
    cancelled_at?: Date;
    cancel_reason?: string;
    cancelled_by?: string;
}
interface RideStopRow {
    stop_id: string;
    tenant_id: string;
    ride_id: string;
    stop_order: number;
    status: string;
    completed_at?: Date;
}
export declare class RidesService {
    createRideFromRequest(tenantId: string, requestId: string, driverId: string): Promise<RideRow>;
    markDriverArrived(tenantId: string, rideId: string): Promise<RideRow>;
    startRide(tenantId: string, rideId: string): Promise<RideRow>;
    completeRide(tenantId: string, rideId: string): Promise<{
        ride: RideRow;
        price: {
            total: number;
            currency: any;
            base_fare: any;
            distance_cost: number;
            dynamic_adjustments: number;
            distance_km: number;
        };
    }>;
    cancelRide(tenantId: string, rideId: string, reason: string, cancelledBy: 'driver' | 'passenger'): Promise<RideRow>;
    completeStop(tenantId: string, rideId: string, stopOrder: number): Promise<RideStopRow>;
    addRideLocation(tenantId: string, rideId: string, lat: number, lng: number): Promise<void>;
    reviewDriver(tenantId: string, rideId: string, passengerId: string, rating: number): Promise<{
        ok: boolean;
    }>;
    reviewPassenger(tenantId: string, rideId: string, driverId: string, rating: number): Promise<{
        ok: boolean;
    }>;
    getRide(tenantId: string, rideId: string): Promise<RideRow>;
}
export declare const ridesService: RidesService;
export {};
//# sourceMappingURL=rides.service.d.ts.map