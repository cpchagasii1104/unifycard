import { EventBus } from '@core/events/event-bus';
type LimitState = {
    can_drive: boolean;
    reason?: string | null;
};
export declare class AvailabilityService {
    private eventBusInstance;
    constructor(eventBusInstance?: EventBus);
    goOnline(tenantId: string, driverId: string, lat: number, lng: number): Promise<{
        ok: boolean;
        sessionId: string | undefined;
        limit: LimitState;
        availability: any;
    }>;
    goOffline(tenantId: string, driverId: string): Promise<{
        ok: boolean;
    }>;
    isOnline(tenantId: string, driverId: string): Promise<boolean>;
    setDestinationMode(tenantId: string, driverId: string, enabled: boolean, dest?: {
        lat?: number;
        lng?: number;
    }): Promise<any>;
    incrementDrivingTime(tenantId: string, driverId: string, minutes: number): Promise<void>;
    getStatus(tenantId: string, driverId: string): Promise<{
        availability: any;
        session: any;
        destinations: any[];
    }>;
}
export declare const availabilityService: AvailabilityService;
export {};
//# sourceMappingURL=availability.service.d.ts.map