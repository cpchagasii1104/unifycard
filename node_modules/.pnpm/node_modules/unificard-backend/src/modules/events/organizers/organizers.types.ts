// src/modules/events/organizers/organizers.types.ts

export type OrganizerRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface EventOrganizer {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  ownerGlobalUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventOrganizerRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_global_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface EventOrganizerMember {
  id: string;
  organizerId: string;
  globalUserId: string;
  role: OrganizerRole;
  createdAt: Date;
}

export interface EventOrganizerMemberRow {
  id: string;
  organizer_id: string;
  global_user_id: string;
  role: string;
  created_at: Date;
}

export interface CreateOrganizerInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface AddOrganizerMemberInput {
  globalUserId: string;
  role: OrganizerRole;
}

export interface LinkEventToOrganizerInput {
  organizerId: string;
}

export interface EventOrganizerWithDetails extends EventOrganizer {
  members?: EventOrganizerMember[];
  memberCount?: number;
  eventCount?: number;
}








