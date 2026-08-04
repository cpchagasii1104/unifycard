// src/api/commitments.ts
// API para painel "Meus Compromissos" (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado

import { apiFetch } from './client';

export interface EventParticipating {
  eventId: string;
  title: string;
  // 🔴 2026-08-04 — datas podem ser NULL: evento declarado sem agenda confirmada é estado REAL
  // (`events.datetime_start` é anulável). O backend devolve null em vez de inventar data.
  startTime: string | null;
  endTime: string | null;
  status: string;
  checkedIn: boolean;
}

export interface EventOrganizing {
  eventId: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
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
  /** `requested`·`confirmed`·`cancelled`·`expired`·`checked_in`·`checked_out` (CHECK físico). */
  status: string;
  requestedAt: string;
  /** A mensagem que acompanhou o pedido. */
  notes: string | null;
  startDatetime: string;
  endDatetime: string;
}

/**
 * 🔴 PEDIDO RECEBIDO — o lado de quem FORNECE (2026-08-04).
 *
 * Não existia superfície nenhuma para isto: a agenda acima é de quem PEDE
 * (`requester_actor_id`). Quem RECEBIA um pedido não tinha onde vê-lo — e a mensagem religada em
 * `bookings.notes` teria chegado a uma coluna que nenhuma tela lia. Pedido que ninguém vê é beco.
 */
export interface IncomingRequest {
  bookingId: string;
  availabilityId: string;
  status: string;
  requestedAt: string;
  notes: string | null;
  startDatetime: string;
  endDatetime: string;
  requesterActorId: string;
  requesterDisplayName: string | null;
  offerLabel: string | null;
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
  incomingRequests: IncomingRequest[];
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

