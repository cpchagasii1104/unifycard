import type { DriverAvailability } from '../../rides.types';
import type { SetAvailabilityInput, SetDestinationModeInput } from '../drivers.types';
export declare class AvailabilityService {
    setOnline(input: SetAvailabilityInput): Promise<DriverAvailability>;
    setOffline(driverId: string): Promise<DriverAvailability>;
    setDestinationMode(input: SetDestinationModeInput): Promise<DriverAvailability>;
    disableDestinationMode(driverId: string, tenantId: string): Promise<DriverAvailability>;
    rewardDestinationSlot(driverId: string, tenantId: string): Promise<void>;
    getAvailability(driverId: string): Promise<DriverAvailability | null>;
}
export declare const availabilityService: AvailabilityService;
//# sourceMappingURL=availability.service.d.ts.map