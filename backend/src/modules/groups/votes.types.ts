// src/modules/groups/votes.types.ts
//
// SSOT = actors/actor_id (pilar IDENTIDADE). O schema vivo (migration
// 20260530430000_groups_missing_tables.sql) é actor-keyed:
//   group_votes(id, created_by_actor_id, is_anonymous, ...)
//   group_vote_options(id, label, ...)
//   group_vote_responses(id, actor_id, UNIQUE(vote_id, actor_id))
// Os DTOs abaixo expõem aliases derivados (voteId=row.id, optionId=row.id,
// responseId=row.id, text=row.label) mas NUNCA usam user_id como identidade
// operacional — a identidade do voto é actor_id (F-GROUPS-VOTES-SCHEMA-DRIFT-FIX).

export type VoteStatus = 'open' | 'closed';

export interface GroupVote {
  voteId: string;
  tenantId: string;
  groupId: string;
  createdByActorId: string;
  title: string;
  description: string | null;
  status: VoteStatus;
  isAnonymous: boolean;
  closesAt: Date | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupVoteOption {
  optionId: string;
  voteId: string;
  tenantId: string;
  text: string; // DTO/API alias; coluna real = group_vote_options.label
  displayOrder: number;
  createdAt: string;
}

export interface GroupVoteResponse {
  responseId: string;
  voteId: string;
  optionId: string;
  tenantId: string;
  actorId: string;
  createdAt: string;
}

/**
 * Input para criar votação no contexto de grupo (POST /api/groups/:groupId/votes).
 * Contrato distinto do módulo votes (CreateVoteInput em votes/votes.types.ts):
 * - usa closesAt (grupo); o módulo votes usa startsAt/endsAt
 * - regras de grupo: título 3–200 chars, 2–20 opções
 * Manter este tipo aqui; não unificar com votes/votes.types sem decisão de domínio.
 */
export interface CreateVoteInput {
  title: string;
  description?: string | null;
  options: string[]; // Array de textos das opções (mínimo 2, máximo 20 - validação app-level)
  closesAt?: string | null; // ISO 8601 datetime string
  // 🔴 FASE 2: startsAt/endsAt são READ-MODEL ou INPUT declarativo, não verdade temporal
  // Não bloqueiam agenda, não resolvem conflito, não criam booking
  startsAt?: string | null;
  endsAt?: string | null;
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
    actorId: string;
    actorName: string | null;
    createdAt: string;
  }>;
}

// Row types for database mapping — colunas REAIS do schema actor-keyed.
interface GroupVoteRow {
  id: string;
  tenant_id: string;
  group_id: string;
  created_by_actor_id: string;
  title: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  closesAt: Date | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupVoteOptionRow {
  id: string;
  vote_id: string;
  tenant_id: string;
  label: string;
  display_order: number;
  createdAt: string;
}

interface GroupVoteResponseRow {
  id: string;
  vote_id: string;
  option_id: string;
  tenant_id: string;
  actor_id: string;
  createdAt: string;
}

export function toGroupVote(row: GroupVoteRow): GroupVote {
  return {
    voteId: row.id,
    tenantId: row.tenant_id,
    groupId: row.group_id,
    createdByActorId: row.created_by_actor_id,
    title: row.title,
    description: row.description,
    status: row.status as VoteStatus,
    isAnonymous: row.is_anonymous,
    closesAt: row.closesAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toGroupVoteOption(row: GroupVoteOptionRow): GroupVoteOption {
  return {
    optionId: row.id,
    voteId: row.vote_id,
    tenantId: row.tenant_id,
    text: row.label,
    displayOrder: row.display_order,
    createdAt: row.createdAt,
  };
}

export function toGroupVoteResponse(row: GroupVoteResponseRow): GroupVoteResponse {
  return {
    responseId: row.id,
    voteId: row.vote_id,
    optionId: row.option_id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    createdAt: row.createdAt,
  };
}
