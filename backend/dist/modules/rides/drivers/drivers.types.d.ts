export interface SetAvailabilityInput {
    tenantId: string;
    driverId: string;
    zoneId?: string | null;
    lat?: number | null;
    lng?: number | null;
}
export interface SetDestinationModeInput {
    tenantId: string;
    driverId: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
    deadline?: Date | null;
    slotsRemaining?: number | null;
}
//# sourceMappingURL=drivers.types.d.ts.map