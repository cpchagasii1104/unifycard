// src/modules/groups/votes.types.ts

export type VoteStatus = 'open' | 'closed';

export interface GroupVote {
  voteId: string;
  tenantId: string;
  groupId: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  status: VoteStatus;
  closesAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupVoteOption {
  optionId: string;
  voteId: string;
  tenantId: string;
  text: string;
  displayOrder: number;
  createdAt: Date;
}

export interface GroupVoteResponse {
  responseId: string;
  voteId: string;
  optionId: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
}

export interface CreateVoteInput {
  title: string;
  description?: string | null;
  options: string[]; // Array de textos das opções (mínimo 2, máximo 20 - validação app-level)
  closesAt?: string | null; // ISO 8601 datetime string
  // 🔴 FASE 2: starts_at/ends_at são READ-MODEL ou INPUT declarativo, não verdade temporal
  // Não bloqueiam agenda, não resolvem conflito, não criam booking
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface VoteOptionWithCount extends GroupVoteOption {
  voteCount: number;
}

export interface VoteWithOptions extends GroupVote {
  options: VoteOptionWithCount[];
  totalVotes: number;
  userVoted: boolean;
  userVoteOptionId: string | null;
}

export interface VoteWithVoters extends VoteWithOptions {
  voters: Array<{
    optionId: string;
    userId: string;
    userName: string | null;
    createdAt: Date;
  }>;
}

// Row types for database mapping
interface GroupVoteRow {
  vote_id: string;
  tenant_id: string;
  group_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  status: string;
  closes_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface GroupVoteOptionRow {
  option_id: string;
  vote_id: string;
  tenant_id: string;
  text: string;
  display_order: number;
  created_at: Date;
}

interface GroupVoteResponseRow {
  response_id: string;
  vote_id: string;
  option_id: string;
  tenant_id: string;
  user_id: string;
  created_at: Date;
}

export function toGroupVote(row: GroupVoteRow): GroupVote {
  return {
    voteId: row.vote_id,
    tenantId: row.tenant_id,
    groupId: row.group_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    description: row.description,
    status: row.status as VoteStatus,
    closesAt: row.closes_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toGroupVoteOption(row: GroupVoteOptionRow): GroupVoteOption {
  return {
    optionId: row.option_id,
    voteId: row.vote_id,
    tenantId: row.tenant_id,
    text: row.text,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

export function toGroupVoteResponse(row: GroupVoteResponseRow): GroupVoteResponse {
  return {
    responseId: row.response_id,
    voteId: row.vote_id,
    optionId: row.option_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}
