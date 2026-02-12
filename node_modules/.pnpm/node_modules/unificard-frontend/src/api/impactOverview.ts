// src/api/impactOverview.ts
// API para impacto passivo (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado

import { apiFetch } from './client';

export interface PendingImpact {
  eventsAffected: number;
  peopleWaiting: number;
  moneyLockedCents: number;
}

export interface NeutralImpact {
  ongoingEvents: number;
  activeGroups: number;
}

export interface ImpactOverview {
  pendingImpact: PendingImpact;
  neutralImpact: NeutralImpact;
  updatedAt: string;
}

/**
 * Busca impacto passivo do usuário (read-only)
 */
export async function getImpactOverview(): Promise<ImpactOverview> {
  const response = await apiFetch('/profile/me/impact-overview');
  if (!response.ok) {
    throw new Error('Erro ao buscar impacto');
  }
  return response.json();
}

