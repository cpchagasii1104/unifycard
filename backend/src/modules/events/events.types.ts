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

/** Linha canónica de `events` (DDL alinhado a core + migration 20260525100000). */
export interface EventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  title: string;
  description: string | null;
  datetime_start: Date | null;
  datetime_end: Date | null;
  timezone: string;
  event_type: string;
  event_subtype: string | null;
  status: string;
  visibility: string;
  ticket_price_cents: number | null;
  max_attendees: number | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
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
  createdAt: string;
}

export interface EventAttendeeRow {
  id: string;
  event_id: string;
  global_user_id: string;
  checked_in_at: Date | null;
  created_at: Date;
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
  created_at: Date;
  updated_at: Date;
}

/** Criação legada do módulo — persiste regional/capacidade em metadata. */
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
  /** Se definido, usa este actor como `events.actor_id`; senão resolve via criador global. */
  actorId?: string;
  /** Taxonomia do evento (≠ `visibility`). Default canónico no writer: `general`. */
  eventType?: string;
  /** IANA; default `UTC`. */
  timezone?: string;
  /** Mesclado em `events.metadata` (ex.: occupancy_model). Campos de servidor (`regional`, `created_by_global_user_id`, …) sobrescrevem chaves conflituosas após o spread. */
  metadata?: Record<string, unknown>;
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
















