// src/api/commitments.ts
// API para painel "Meus Compromissos" (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado

import { apiFetch } from './client';

export interface EventParticipating {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  checkedIn: boolean;
}

export interface EventOrganizing {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface GroupManaging {
  groupId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface AgendaBooking {
  bookingId: string;
  availabilityId: string;
  status: string;
  requestedAt: string;
  startDatetime: string;
  endDatetime: string;
}

export interface EconomySummary {
  totalInvolved: number;
  totalSpent: number;
  totalReceived: number;
}

export interface Commitments {
  eventsParticipating: EventParticipating[];
  eventsOrganizing: EventOrganizing[];
  groupsManaging: GroupManaging[];
  agendaBookings: AgendaBooking[];
  inboxPendingCount: number;
  economySummary: EconomySummary;
  updatedAt: string;
}

/**
 * Busca compromissos do usuário (read-only)
 */
export async function getCommitments(): Promise<Commitments> {
  const response = await apiFetch('/profile/me/commitments');
  if (!response.ok) {
    throw new Error('Erro ao buscar compromissos');
  }
  return response.json();
}

