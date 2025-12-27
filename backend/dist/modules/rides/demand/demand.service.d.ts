import { EventBus } from '@core/events/event-bus';
export declare class DemandService {
    private eventBusInstance;
    constructor(eventBusInstance?: EventBus);
    calculateZonePressure(tenantId: string, zoneId: string): Promise<any>;
    refreshAllZones(tenantId: string): Promise<any[]>;
    getZoneIncentives(tenantId: string, zoneId: string): Promise<any[]>;
    notifyDriversHotZone(tenantId: string, zoneId: string, pressure: number): Promise<{
        notified: number;
    }>;
    suggestBetterZone(tenantId: string, _driverId: string): Promise<any[] | null>;
    cleanupExpiredIncentives(tenantId: string): Promise<{
        deactivated: number;
    }>;
}
export declare const demandService: DemandService;
//# sourceMappingURL=demand.service.d.ts.map