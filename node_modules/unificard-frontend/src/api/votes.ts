// src/api/votes.ts
// API client para sistema de votações

import { apiFetchJson } from './client';

export interface Vote {
  vote_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  created_by_actor_id: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  options: VoteOption[];
  results?: VoteResult[];
  has_voted?: boolean;
  total_votes?: number;
}

export interface VoteOption {
  option_id: string;
  vote_id: string;
  label: string;
  created_at: string;
}

export interface VoteResult {
  option_id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CreateVoteInput {
  title: string;
  description?: string;
  options: string[];
  starts_at?: string;
  ends_at?: string;
}

export interface VotesListResponse {
  votes: Vote[];
  total: number;
}

/**
 * Cria uma nova votação (status = draft)
 */
export async function createVote(input: CreateVoteInput): Promise<Vote> {
  return apiFetchJson<Vote>('/api/votes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Publica uma votação (muda status para active)
 */
export async function publishVote(voteId: string): Promise<Vote> {
  return apiFetchJson<Vote>(`/api/votes/${voteId}/publish`, {
    method: 'POST',
  });
}

/**
 * Registra voto do actor ativo
 */
export async function vote(voteId: string, optionId: string): Promise<void> {
  return apiFetchJson<void>(`/api/votes/${voteId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}

/**
 * Lista votações
 */
export async function listVotes(options?: {
  status?: 'draft' | 'active' | 'closed';
  limit?: number;
  offset?: number;
}): Promise<VotesListResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const query = params.toString();
  return apiFetchJson<VotesListResponse>(`/api/votes${query ? `?${query}` : ''}`);
}

/**
 * Busca detalhes de uma votação
 */
export async function getVote(voteId: string): Promise<Vote> {
  return apiFetchJson<Vote>(`/api/votes/${voteId}`);
}

/**
 * Encerra uma votação (muda status para closed)
 */
export async function closeVote(voteId: string): Promise<Vote> {
  return apiFetchJson<Vote>(`/api/votes/${voteId}/close`, {
    method: 'POST',
  });
}

/**
 * Busca dados de auditoria
 */
export async function getVoteAudit(voteId: string): Promise<{
  vote_id: string;
  title: string;
  status: string;
  total_votes: number;
  results: VoteResult[];
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
}> {
  return apiFetchJson(`/api/votes/${voteId}/audit`);
}

