// frontend/src/api/pilot-invites.ts
// SPRINT 14: API para convites do modo piloto

import { apiFetch, extractErrorMessage } from './client';

export type PilotInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PilotInvite {
  inviteId: string;
  tenantId: string;
  email: string;
  invitedByUserId: string;
  status: PilotInviteStatus;
  invitedAt: string;
  acceptedAt?: string;
  expiresAt: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreatePilotInviteInput {
  email: string;
  metadata?: Record<string, any>;
}

/**
 * Lista convites
 */
export async function listPilotInvites(options?: {
  limit?: number;
  offset?: number;
  status?: PilotInviteStatus;
}): Promise<PilotInvite[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.status) params.append('status', options.status);

  const response = await apiFetch(`/admin/pilot/invites?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao listar convites'));
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Cria um novo convite
 */
export async function createPilotInvite(input: CreatePilotInviteInput): Promise<PilotInvite> {
  const response = await apiFetch('/admin/pilot/invites', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao criar convite'));
  }

  const data = await response.json();
  return data.data;
}

/**
 * Revoga convite
 */
export async function revokePilotInvite(inviteId: string): Promise<PilotInvite> {
  const response = await apiFetch(`/admin/pilot/invites/${inviteId}/revoke`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao revogar convite'));
  }

  const data = await response.json();
  return data.data;
}







