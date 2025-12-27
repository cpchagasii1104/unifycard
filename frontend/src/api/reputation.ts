// src/api/reputation.ts
// API para Reputação Progressiva & Permissões (FASE 11)

import { apiFetch } from './client';

export interface ActorPermissions {
  canVote: boolean;
  canCreateProject: boolean;
  canCreateCTA: boolean;
  hasExtendedReach: boolean;
  hasAdvancedAccess: boolean;
}

/**
 * Busca permissões do ator baseado em reputação e status
 */
export async function getActorPermissions(
  actorId: string,
  actorType: 'user' | 'page',
  companyStatus?: string
): Promise<ActorPermissions> {
  const queryParams = new URLSearchParams();
  queryParams.append('actor_id', actorId);
  queryParams.append('actor_type', actorType);
  if (companyStatus) {
    queryParams.append('company_status', companyStatus);
  }

  const response = await apiFetch(`/social/reputation/permissions?${queryParams.toString()}`);
  return response.json();
}

