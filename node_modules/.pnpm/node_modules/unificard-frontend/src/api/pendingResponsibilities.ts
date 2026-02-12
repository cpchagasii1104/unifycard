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

