// frontend/src/api/group-votes.ts
// API Client para Group Votes
// SPRINT: Groups MVP

import { apiFetch } from './client';

export type VoteStatus = 'open' | 'closed';

export interface GroupVote {
  voteId: string;
  tenantId: string;
  groupId: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  status: VoteStatus;
  closesAt: string | null; // ISO 8601
  createdAt: string;
  updatedAt: string;
  totalVotes?: number;
}

export interface GroupVoteOption {
  optionId: string;
  voteId: string;
  tenantId: string;
  text: string;
  displayOrder: number;
  createdAt: string;
  voteCount?: number;
}

export interface VoteWithOptions extends GroupVote {
  options: GroupVoteOption[];
  totalVotes: number;
  userVoted: boolean;
  userVoteOptionId: string | null;
}

export interface CreateVoteInput {
  title: string;
  description?: string | null;
  options: string[];
  closesAt?: string | null;
}

/**
 * Listar votações do grupo
 */
export async function listGroupVotes(groupId: string, status?: VoteStatus): Promise<GroupVote[]> {
  const queryParams = new URLSearchParams();
  if (status) queryParams.append('status', status);

  const query = queryParams.toString();
  const response = await apiFetch(`/api/groups/${groupId}/votes${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar votações' }));
    throw new Error(error.error || 'Erro ao listar votações');
  }
  const result = await response.json();
  return result.votes || [];
}

/**
 * Buscar detalhes de uma votação
 */
export async function getGroupVote(groupId: string, voteId: string): Promise<VoteWithOptions> {
  const response = await apiFetch(`/api/groups/${groupId}/votes/${voteId}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar votação' }));
    throw new Error(error.error || 'Erro ao buscar votação');
  }
  const result = await response.json();
  return result.vote;
}

/**
 * Votar em uma opção
 */
export async function voteOnGroupVote(groupId: string, voteId: string, optionId: string): Promise<VoteWithOptions> {
  const response = await apiFetch(`/api/groups/${groupId}/votes/${voteId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao votar' }));
    throw new Error(error.error || 'Erro ao votar');
  }
  const result = await response.json();
  return result.vote;
}

/**
 * Fechar votação (apenas admin/owner)
 */
export async function closeGroupVote(groupId: string, voteId: string): Promise<GroupVote> {
  const response = await apiFetch(`/api/groups/${groupId}/votes/${voteId}/close`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao fechar votação' }));
    throw new Error(error.error || 'Erro ao fechar votação');
  }
  const result = await response.json();
  return result.vote;
}




