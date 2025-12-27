// src/modules/events/events.types.ts

export interface Event {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  datetimeStart: Date;
  datetimeEnd: Date;
  locationName: string | null;
  capacity: number | null;
  cityId: string | null;
  stateId: string | null;
  countryId: string | null;
  createdByGlobalUserId: string;
  createdByActorId: string | null;
  eventType?: string;
  ticketPrice?: number | null;
  acceptsConsumption?: boolean;
  acceptsParking?: boolean;
  maxCapacity?: number | null;
  currentOccupancy?: number;
  status: 'draft' | 'published' | 'cancelled' | 'finished';
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  start_time: Date;
  end_time: Date;
  city_id: string | null;
  state_id: string | null;
  country_id: string | null;
  created_by_global_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface EventSession {
  id: string;
  eventId: string;
  name: string;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSessionRow {
  id: string;
  event_id: string;
  name: string;
  start_time: Date;
  end_time: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EventLocation {
  id: string;
  eventId: string;
  name: string;
  capacity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventLocationRow {
  id: string;
  event_id: string;
  name: string;
  capacity: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface EventStaff {
  id: string;
  eventId: string;
  globalUserId: string;
  role: string;
  assignedByGlobalUserId: string;
  createdAt: Date;
}

export interface EventStaffRow {
  id: string;
  event_id: string;
  global_user_id: string;
  role: string;
  assigned_by_global_user_id: string;
  created_at: Date;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  globalUserId: string;
  checkInTime: Date | null;
  createdAt: Date;
}

export interface EventAttendeeRow {
  id: string;
  event_id: string;
  global_user_id: string;
  check_in_time: Date | null;
  created_at: Date;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
}

export interface AddSessionInput {
  name: string;
  startTime: Date;
  endTime: Date;
}

export interface AssignStaffInput {
  globalUserId: string;
  role: string;
}

export interface EventWithDetails extends Event {
  sessions?: EventSession[];
  locations?: EventLocation[];
  staff?: EventStaff[];
  attendeeCount?: number;
  checkedInCount?: number;
}

export interface SearchEventsOptions {
  cityId?: string;
  stateId?: string;
  countryId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ===========================
// EVENT ACTOR (Multi-Actor System)
// ===========================

export type EventActorRole = 'artist' | 'venue' | 'organizer' | 'sponsor' | 'supporter';
export type EventActorStatus = 'pending' | 'accepted' | 'rejected' | 'removed';

export interface EventActor {
  id: string;
  tenantId: string;
  eventId: string;
  actorId: string;
  role: EventActorRole;
  canPublish: boolean;
  canEdit: boolean;
  revenueSharePercent: number | null;
  status: EventActorStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventActorRow {
  id: string;
  tenant_id: string;
  event_id: string;
  actor_id: string;
  role: string;
  can_publish: boolean;
  can_edit: boolean;
  revenue_share_percent: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  datetimeStart: Date;
  datetimeEnd: Date;
  locationName?: string | null;
  capacity?: number | null;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  actorId: string; // Actor que está criando o evento
}

export interface AddActorToEventInput {
  eventId: string;
  actorId: string;
  role: EventActorRole;
  canPublish?: boolean;
  canEdit?: boolean;
  revenueSharePercent?: number | null;
}

export interface EventWithActors extends Event {
  actors?: EventActor[];
}








