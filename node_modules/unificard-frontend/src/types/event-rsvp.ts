// frontend/src/types/event-rsvp.ts
// Tipos para RSVP (confirmação de presença) em eventos

export type RSVPStatus = 'yes' | 'no' | 'maybe';

export interface EventRSVP {
  id: string;
  event_id: string;
  tenant_id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  status: RSVPStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RSVPCounts {
  yes: number;
  no: number;
  maybe: number;
}



