// src/api/pendingResponsibilities.ts
// API para pendências (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado

import { apiFetch } from './client';

export interface PendingEvent {
  id: string;
  title: string;
  type: 'event';
  status: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface PendingGroup {
  id: string;
  name: string;
  type: 'group';
  status: string;
  needsFinancialPurpose: boolean;
  createdAt: string;
}

export interface PendingService {
  id: string;
  title: string;
  type: 'service';
  status: string;
  pendingBookingsCount: number;
  createdAt: string;
}

export interface PendingPayment {
  id: string;
  type: 'payment';
  status: string;
  amount: number;
  currency: string;
  serviceId: string | null;
  bookingId: string | null;
  requestedAt: string;
}

export interface PendingBooking {
  id: string;
  availabilityId: string;
  type: 'booking';
  status: string;
  requesterActorId: string;
  ownerType: string;
  ownerId: string;
  startDatetime: string;
  endDatetime: string;
  requestedAt: string;
  /**
   * 🔴 O CONTEXTO PARA DECIDIR (2026-08-05). O dono via um intervalo de tempo e um id de actor, e
   * tinha que aceitar ou recusar com isso. Tudo abaixo é RESOLVIDO NO SERVIDOR — a tela projeta.
   */
  /** O que a pessoa escreveu no pedido. Gravado em `bookings.notes` desde sempre; nunca era lido. */
  notes: string | null;
  eventId: string | null;
  /** Título nulo com `eventId` presente = existe evento e o nome não foi lido. NÃO é "sem evento". */
  eventTitle: string | null;
  requester: {
    actorId: string;
    displayName: string | null;
    /** Desde quando o actor existe. `null` = não sei — e não-sei não vira "recém-chegado". */
    memberSince: string | null;
    /** Compromissos REAIS já cumpridos (confirmed/checked_in/checked_out). Contagem, não score. */
    completedCommitments: number;
    /** Reputação DORMENTE: 5 substratos, 0 linhas. `null` honesto — nunca número inventado. */
    trust: null;
  };
}

export interface PendingResponsibilities {
  pendingEvents: PendingEvent[];
  pendingGroups: PendingGroup[];
  pendingServices: PendingService[];
  pendingPayments: PendingPayment[];
  pendingBookings: PendingBooking[];
  updatedAt: string;
}

/**
 * Busca pendências do usuário (read-only)
 */
export async function getPendingResponsibilities(): Promise<PendingResponsibilities> {
  const response = await apiFetch('/profile/me/pending-responsibilities');
  if (!response.ok) {
    throw new Error('Erro ao buscar pendências');
  }
  return response.json();
}

