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
  status: 'draft' | 'published' | 'cancelled' | 'finished' | 'completed' | 'archived';
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  city_id: string | null;
  state_id: string | null;
  country_id: string | null;
  created_by_global_user_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSession {
  id: string;
  eventId: string;
  name: string;
  startTime: Date;
  endTime: Date;
  createdAt: string;
  updatedAt: string;
}

export interface EventSessionRow {
  id: string;
  event_id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  createdAt: string;
  updatedAt: string;
}

export interface EventLocation {
  id: string;
  eventId: string;
  name: string;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventLocationRow {
  id: string;
  event_id: string;
  name: string;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventStaff {
  id: string;
  eventId: string;
  globalUserId: string;
  role: string;
  assignedByGlobalUserId: string;
  createdAt: string;
}

export interface EventStaffRow {
  id: string;
  event_id: string;
  global_user_id: string;
  role: string;
  assigned_by_global_user_id: string;
  createdAt: string;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  globalUserId: string;
  checkInTime: Date | null;
  createdAt: string;
}

export interface EventAttendeeRow {
  id: string;
  event_id: string;
  global_user_id: string;
  checked_in_at: Date | null;
  createdAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  group_id?: string; // ID do grupo para vincular o evento
}

export interface AddSessionInput {
  name?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface AssignStaffInput {
  globalUserId?: string;
  role?: string;
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
  revenueShareBps: number | null;
  status: EventActorStatus;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  locationName?: string | null;
  capacity?: number | null;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  group_id?: string;
  actorId?: string; // Actor que está criando o evento
}

export interface AddActorToEventInput {
  eventId: string;
  actorId: string;
  role: EventActorRole;
  canPublish?: boolean;
  canEdit?: boolean;
  revenueShareBps?: number | null;
}

export interface EventWithActors extends Event {
  actors?: EventActor[];
}
















