// backend/src/modules/marketplace/referral.types.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

/**
 * Código de indicação
 */
export interface ReferralCode {
  id: string;
  tenantId: string;
  code: string;
  ownerActorId: string;
  groupId: string | null;
  isActive: boolean;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Input para criar código de indicação
 */
export interface CreateReferralCodeInput {
  code: string;
  ownerActorId: string;
  groupId?: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado da resolução de código
 */
export interface ResolvedReferralCode {
  referralCode: ReferralCode;
  ownerActorId: string;
  groupId: string | null;
}






