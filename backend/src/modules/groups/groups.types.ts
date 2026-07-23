// src/modules/groups/groups.types.ts

export type GroupMemberRole = 'member' | 'moderator' | 'owner' | 'admin' | 'collaborator';
export type GroupVisibility = 'public' | 'private' | 'secret';
export type GroupScope = 'national' | 'state' | 'city' | 'neighborhood';
export type GroupCampaignType = 'donation' | 'action' | 'fundraising' | 'awareness';
export type GroupCampaignStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type GroupTimelineType = 'event' | 'campaign' | 'finance' | 'milestone';
export type GroupCommentTargetType = 'post' | 'event' | 'campaign' | 'finance';
export type GroupReactionType = 'like' | 'disagree';
export type GroupTransactionType = 'income' | 'expense';
export type GroupContactMessageStatus = 'open' | 'replied' | 'closed';
export type GroupReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface Group {
  groupId: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string; // Obrigatória
  audienceDescription?: string; // Descrição curta do público-alvo
  categoryId?: string; // UUID da categoria
  visibility: GroupVisibility;
  scope: GroupScope;
  countryId?: string;
  stateId?: string;
  cityId?: string;
  neighborhood?: string;
  avatarUrl?: string;
  coverUrl?: string;
  rulesText?: string;
  financialPurpose?: string; // Finalidade dos recursos financeiros
  ownerActorId: string; // actor_id (referência canônica a actors.id)
  isActive: boolean;
  profitBps?: number; // 0-100, percentual de lucro que o grupo recebe
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// D9.2-B (DECISION-0188): projecao legada da membership Actor-first.
// Verdade = group_actor_memberships (member_actor_id). userId aqui e RESOLVIDO do user-actor
// (null p/ membros institucionais page/group). role e DERIVADA (owner = groups.owner_actor_id;
// demais = member) — nunca persistida como fonte (D11).
export interface GroupMember {
  groupId: string;
  userId: string | null; // users.user_id do user-actor membro (resolucao, nao identidade da casa)
  memberActorId: string; // identidade canonica da membership (actors.id)
  membershipId: string; // linha em group_actor_memberships
  role: GroupMemberRole;
  joinedAt: Date;
}

export interface GroupAccount {
  groupId: string;
  accountId: string;
  createdAt: string;
}

export interface CreateGroupInput {
  name?: string;
  description?: string; // Obrigatória
  audience_description?: string; // Descrição curta do público-alvo
  category_id?: string; // UUID da categoria (obrigatória)
  visibility?: GroupVisibility; // Opcional, default 'public'
  scope?: GroupScope; // Opcional, default 'national'
  country_id?: string; // Obrigatório
  state_id?: string; // Obrigatório se scope >= 'state'
  city_id?: string; // Obrigatório se scope >= 'city'
  neighborhood?: string; // Obrigatório se scope == 'neighborhood'
  avatar_url?: string;
  cover_url?: string;
  rules_text?: string;
  slug?: string; // Opcional - será gerado automaticamente
  financial_purpose?: string; // Obrigatório se hasFinancialIntent = true
  /** DECISION-0163: propósito GOVERNADO (GROUP_PURPOSES) — eixo ortogonal à categoria. */
  purpose?: string;
  metadata?: Record<string, any>;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  audience_description?: string;
  category_id?: string;
  visibility?: GroupVisibility;
  scope?: GroupScope;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  neighborhood?: string;
  avatar_url?: string;
  cover_url?: string;
  rules_text?: string;
  slug?: string;
  isActive?: boolean;
  financial_purpose?: string; // Obrigatório se hasFinancialIntent = true
  metadata?: Record<string, any>;
  profitBps?: number; // 0-100
}

export interface GroupCategory {
  categoryId: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  memberCount: number;
}

// D9.2-B: vocabulario FISICO de group_invites (CHECK vivo) inclui 'rejected'/'cancelled';
// 'declined' permanece apenas como alias legado de entrada (normalizado para 'rejected').
export type GroupInviteStatus = 'pending' | 'accepted' | 'rejected' | 'declined' | 'expired' | 'cancelled';

export interface GroupInvite {
  inviteId: string;
  groupId: string;
  // D9.2-B: colunas fisicas sao invited_actor_id/invited_by_actor_id — namespace ACTOR (D13).
  invitedUserId: string; // = invited_actor_id (actor canonico convidado)
  invitedByUserId: string; // = invited_by_actor_id (actor iniciador)
  status: GroupInviteStatus;
  expiresAt: Date | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInviteInput {
  invited_user_id: string; // global_user_id
}

export interface RequestJoinGroupInput {
  expires_in_days?: number; // Opcional, default 7 dias
}

export interface GroupInviteWithGroup extends GroupInvite {
  group?: Group; // Grupo relacionado (opcional, para listagem do usuário)
}

export interface GroupInsights {
  groupId: string;
  name: string;
  totalReceived: number;
  memberCount: number;
  impactGenerated?: string;
  participationLogs: Array<{
    action: string;
    timestamp: Date;
    userId: string;
  }>;
  aiSummary?: string;
}

// ============================================================
// CANAL DE CONTATO
// ============================================================

export interface GroupContactMessage {
  messageId: string;
  groupId: string;
  tenantId: string;
  senderUserId: string;
  message: string;
  status: GroupContactMessageStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// POSTS, COMENTÁRIOS, REAÇÕES E DENÚNCIAS
// ============================================================

export interface GroupPost {
  postId: string;
  groupId: string;
  tenantId: string;
  authorId: string;
  content: string;
  media?: any[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupComment {
  commentId: string;
  groupId: string;
  tenantId: string;
  targetType: GroupCommentTargetType;
  targetId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupReaction {
  reactionId: string;
  groupId: string;
  tenantId: string;
  targetType: GroupCommentTargetType;
  targetId: string;
  userId: string;
  type: GroupReactionType;
  createdAt: string;
}

export interface GroupReport {
  reportId: string;
  groupId: string;
  tenantId: string;
  targetType: 'post' | 'event' | 'campaign' | 'comment';
  targetId: string;
  reporterUserId: string;
  reason: string;
  status: GroupReportStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// VOTAÇÕES
// ============================================================

export interface GroupPoll {
  pollId: string;
  groupId: string;
  tenantId: string;
  question: string;
  options: string[]; // Array de opções
  createdBy: string;
  endsAt?: Date;
  createdAt: string;
  updatedAt: string;
}

export interface GroupPollVote {
  pollId: string;
  userId: string;
  optionIndex: number; // Índice da opção escolhida
  createdAt: string;
}

// ============================================================
// AGENDA E EVENTOS
// ============================================================

/**
 * 🔴 FASE 2: INPUT DECLARATIVO — NÃO É VERDADE TEMPORAL
 * 
 * GroupSchedule é apenas INPUT declarativo de recorrência.
 * 
 * REGRAS ABSOLUTAS:
 * - NÃO cria slots
 * - NÃO bloqueia agenda
 * - NÃO resolve conflito
 * - NÃO cria booking
 * - NÃO interfere em Unified Availability
 * 
 * Esta estrutura serve apenas como:
 * - INPUT para criação futura de Unified Availability (quando grupo confirmar)
 * - READ-MODEL para exibição de recorrência declarada
 * 
 * A verdade temporal está exclusivamente em Unified Availability (tabela `availability`).
 */
export interface GroupSchedule {
  scheduleId: string;
  groupId: string;
  tenantId: string;
  title: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfWeek?: number; // 0 = domingo, 6 = sábado
  time?: string; // TIME format
  createdAt: string;
  updatedAt: string;
}

/**
 * 🔴 FASE 2: READ-MODEL ou INPUT DECLARATIVO — NÃO É VERDADE TEMPORAL
 * 
 * GroupEvent.startsAt e GroupEvent.endsAt são:
 * - READ-MODEL de visualização (se usado apenas para exibição)
 * - INPUT declarativo (se usado para criação futura de evento)
 * 
 * REGRAS ABSOLUTAS:
 * - NÃO bloqueia agenda
 * - NÃO resolve conflito
 * - NÃO cria booking
 * - NÃO interfere em Unified Availability
 * 
 * Se group_events for mantida, startsAt/endsAt devem ser tratados apenas como:
 * - INPUT declarativo para criação futura de evento (que criará availability)
 * - READ-MODEL para exibição de eventos do grupo
 * 
 * A verdade temporal está exclusivamente em Unified Availability (tabela `availability`).
 */
export interface GroupEvent {
  eventId: string;
  groupId: string;
  tenantId: string;
  title: string;
  description?: string;
  // 🔴 FASE 2: startsAt/endsAt são READ-MODEL ou INPUT declarativo, não verdade temporal
  startsAt: Date;
  endsAt?: Date;
  location?: string;
  visibility: GroupVisibility;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TIMELINE
// ============================================================

export interface GroupTimeline {
  timelineId: string;
  groupId: string;
  tenantId: string;
  type: GroupTimelineType;
  title: string;
  description?: string;
  date: Date;
  mediaUrl?: string;
  relatedId?: string; // ID do evento, campanha, transação ou milestone
  createdAt: string;
}

// ============================================================
// CAMPANHAS
// ============================================================

export interface GroupCampaign {
  campaignId: string;
  groupId: string;
  tenantId: string;
  title: string;
  description: string;
  type: GroupCampaignType;
  startsAt: Date;
  endsAt?: Date;
  goalValue?: number; // Meta em reais
  currentValue: number; // Valor atual arrecadado/atingido
  status: GroupCampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TRANSPARÊNCIA FINANCEIRA
// ============================================================

export interface GroupBalance {
  groupId: string;
  tenantId: string;
  currentBalance: number;
  updatedAt: string;
}

export interface GroupTransaction {
  transactionId: string;
  groupId: string;
  tenantId: string;
  type: GroupTransactionType;
  category: string; // Ex: 'donation', 'event_revenue', 'expense_rent', etc
  description: string;
  amountCents: number;
  createdBy: string;
  relatedCampaignId?: string;
  createdAt: string;
  updatedAt: string;
}













