// Stub: schedule module was consolidated into Unified Availability.
// Minimal types for social-work integration until migration.

export interface ScheduleSlot {
  slotId: string;
  scheduleId: string;
  startTime: Date;
  endTime: Date;
  status?: string;
  reservedByGlobalUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface Schedule {
  scheduleId: string;
  ownerGlobalUserId: string;
  slots?: ScheduleSlot[];
}