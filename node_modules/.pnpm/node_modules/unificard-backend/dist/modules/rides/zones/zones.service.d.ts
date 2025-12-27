export declare class ZonesService {
    createZone(tenantId: string, cityId: string, data: any): Promise<{
        zone_id: string;
        name: string;
        city_id: string;
    }>;
    updateZone(tenantId: string, zoneId: string, patch: any): Promise<any>;
    findZoneByPoint(tenantId: string, lat: number, lng: number): Promise<{
        zone_id: string;
        name: string;
        city_id: string;
    } | undefined>;
    listZonesByCity(tenantId: string, cityId: string): Promise<{
        zone_id: string;
        name: string;
        area_m2: number;
        created_at: Date;
    }[]>;
    getZone(tenantId: string, zoneId: string): Promise<any>;
    deleteZone(tenantId: string, zoneId: string): Promise<{
        ok: boolean;
    }>;
    recalcDemandForZone(tenantId: string, zoneId: string): Promise<{
        ok: boolean;
    }>;
}
export declare const zonesService: ZonesService;
//# sourceMappingURL=zones.service.d.ts.map