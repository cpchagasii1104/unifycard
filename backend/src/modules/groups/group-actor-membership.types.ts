// backend/src/modules/groups/group-actor-membership.types.ts
// D9.2-A (DECISION-0188) — tipos INTERNOS da fundação Actor-first DORMENTE da membership.
// Casa física: group_actor_memberships (escrita SÓ via fns canônicas; app sem DML direto).
// ZERO caller de produto até o cutover D9.2-B. Identidade persistida = member_actor_id;
// user_id/global_user_id NÃO são colunas de membership (aparecem apenas no read-model de medição).

/** Vocabulário FECHADO do lifecycle (DECISION-0188 D7): active → left | removed (terminais). */
export type GroupActorMembershipStatus = 'active' | 'left' | 'removed';

/** Vocabulário FECHADO da intenção explícita (DECISION-0188 D9). NULL legado ≠ invite. */
export type GroupMembershipIntentKind = 'invite' | 'request';

export interface GroupActorMembership {
  id: string;
  tenantId: string;
  groupId: string;
  memberActorId: string;
  status: GroupActorMembershipStatus;
  entryIdempotencyKey: string;
  createdByActorId: string;
  createdAt: string;
  sourceIntentId: string | null;
  leftByActorId: string | null;
  leftAt: string | null;
  removedByActorId: string | null;
  removedAt: string | null;
}

export interface EnterMembershipSelfInput {
  tenantId: string;
  /** principal autenticado (req.user.userId) — resolvido server-side; NUNCA payload */
  actingUserId: string;
  groupId: string;
  idempotencyKey: string;
}

export interface EnterMembershipAsRepresentativeInput {
  tenantId: string;
  actingUserId: string;
  groupId: string;
  /** page-actor formal OU group-actor RAIZ — exige canRepresentActor(memberActorId) */
  memberActorId: string;
  idempotencyKey: string;
}

export interface LeaveMembershipInput {
  tenantId: string;
  actingUserId: string;
  membershipId: string;
}

export interface RemoveMembershipInput {
  tenantId: string;
  actingUserId: string;
  membershipId: string;
}

export interface CreateMembershipIntentInput {
  tenantId: string;
  actingUserId: string;
  groupId: string;
  candidateActorId: string;
  intentKind: GroupMembershipIntentKind;
  idempotencyKey: string;
}

export interface AcceptMembershipIntentInput {
  tenantId: string;
  actingUserId: string;
  intentId: string;
}

/** Classificação por row da shadow validation (DECISION-0188 D16 fase de medição; §16 do envelope). */
export type LegacyMembershipReadiness =
  | 'ready'
  | 'missing_user'
  | 'missing_identity'
  | 'missing_user_actor'
  | 'ambiguous_user_actor'
  | 'tenant_mismatch'
  | 'invalid_group';

export interface LegacyMembershipShadowRow {
  legacyMembershipId: string;
  tenantId: string;
  groupId: string;
  legacyUserId: string;
  globalUserId: string | null;
  candidateMemberActorId: string | null;
  readiness: LegacyMembershipReadiness;
}

export interface LegacyMembershipShadowReport {
  totalLegacyRows: number;
  readyRows: number;
  rows: LegacyMembershipShadowRow[];
  deterministic: boolean;
}
