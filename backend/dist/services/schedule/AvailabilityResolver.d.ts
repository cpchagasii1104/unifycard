import { DateTime } from 'luxon';
export declare class AvailabilityResolver {
    checkEmployeeAvailability(params: {
        employeeId: string;
        companyId: string;
        tenantId: string;
        serviceId?: string;
        startTime: DateTime;
        endTime: DateTime;
    }): Promise<{
        available: boolean;
        reason?: string;
    }>;
    /**
     * Reserva slot com proteção contra overbooking
     */
    reserveSlot(params: {
        scheduleId: string;
        slotId: string;
        userId: string;
        tenantId: string;
        actionId?: string;
    }): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=AvailabilityResolver.d.ts.map