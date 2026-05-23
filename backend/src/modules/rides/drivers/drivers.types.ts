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
  /** Contador operacional (coluna legada `destination_slots_remaining`), não vaga de calendário. */
  slotsRemaining?: number | null;
}

