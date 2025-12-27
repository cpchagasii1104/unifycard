export declare class VehiclesService {
    registerVehicle(tenantId: string, driverId: string, data: any): Promise<any>;
    approveVehicle(tenantId: string, vehicleId: string, adminId: string): Promise<any>;
    rejectVehicle(tenantId: string, vehicleId: string, reason: string): Promise<any>;
    activateVehicle(tenantId: string, driverId: string, vehicleId: string): Promise<any>;
    listDriverVehicles(tenantId: string, driverId: string): Promise<any[]>;
    getVehicle(tenantId: string, vehicleId: string): Promise<any>;
    deleteVehicle(tenantId: string, vehicleId: string): Promise<{
        ok: boolean;
    }>;
}
export declare const vehiclesService: VehiclesService;
//# sourceMappingURL=vehicles.service.d.ts.map