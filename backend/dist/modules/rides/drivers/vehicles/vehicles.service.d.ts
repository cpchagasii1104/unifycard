export interface RideVehicle {
    vehicle_id: string;
    tenant_id: string;
    driver_id: string;
    plate: string;
    model?: string;
    brand?: string;
    year?: number;
    color?: string;
    category?: string;
    service_type_id?: string;
    is_verified: boolean;
    verified_by_partner_id?: string;
    verified_at?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface CreateVehicleInput {
    tenantId: string;
    driverId: string;
    plate: string;
    model?: string;
    brand?: string;
    year?: number;
    color?: string;
    category?: string;
    serviceTypeId?: string;
}
export interface UpdateVehicleInput {
    plate?: string;
    model?: string;
    brand?: string;
    year?: number;
    color?: string;
    category?: string;
    serviceTypeId?: string;
}
export declare class VehiclesService {
    createVehicle(input: CreateVehicleInput): Promise<RideVehicle>;
    updateVehicle(tenantId: string, vehicleId: string, input: UpdateVehicleInput): Promise<RideVehicle>;
    listVehicles(tenantId: string, driverId: string): Promise<RideVehicle[]>;
    getVehicleById(tenantId: string, vehicleId: string): Promise<RideVehicle | null>;
    verifyVehicle(tenantId: string, vehicleId: string, partnerId: string): Promise<RideVehicle>;
}
export declare const vehiclesService: VehiclesService;
//# sourceMappingURL=vehicles.service.d.ts.map