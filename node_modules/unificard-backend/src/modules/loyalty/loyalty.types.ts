// backend/src/modules/loyalty/loyalty.types.ts
// SPRINT 93: LOYALTY / FIDELIDADE

export type LoyaltyAccountStatus = 'ACTIVE' | 'SUSPENDED';
export type LoyaltyLedgerEntryType = 'EARN' | 'REDEEM' | 'ADJUST';
export type LoyaltyRuleStatus = 'ACTIVE' | 'INACTIVE';
export type LoyaltyRuleType = 'PERCENT_OF_AMOUNT' | 'FIXED_POINTS';
export type LoyaltyRuleAppliesTo = 'CHANNEL' | 'SEGMENT' | 'ACTOR' | 'EVENT' | 'VARIANT' | 'CATEGORY';
export type LoyaltyVoucherStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
export type LoyaltyVoucherType = 'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'BENEFIT_FLAG';

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  contactId: string;
  status: LoyaltyAccountStatus;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyLedgerEntry {
  id: string;
  tenantId: string;
  contactId: string;
  entryType: LoyaltyLedgerEntryType;
  points: number; // signed
  referenceType: string | null;
  referenceId: string | null;
  reasonCode: string | null;
  description: string | null;
  createdByActorId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export interface LoyaltyRule {
  id: string;
  tenantId: string;
  name: string;
  status: LoyaltyRuleStatus;
  ruleType: LoyaltyRuleType;
  value: number;
  appliesTo: LoyaltyRuleAppliesTo;
  appliesId: string | null;
  minAmount: number | null;
  maxPointsPerDay: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface LoyaltyVoucher {
  id: string;
  tenantId: string;
  contactId: string;
  status: LoyaltyVoucherStatus;
  voucherType: LoyaltyVoucherType;
  value: number | null;
  benefitCode: string | null;
  expiresAt: Date | null;
  createdFromLedgerId: string | null;
  usedReferenceType: string | null;
  usedReferenceId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  usedAt: Date | null;
}

export interface CreateLoyaltyRuleInput {
  name: string;
  status?: LoyaltyRuleStatus;
  ruleType: LoyaltyRuleType;
  value: number;
  appliesTo: LoyaltyRuleAppliesTo;
  appliesId?: string | null;
  minAmount?: number | null;
  maxPointsPerDay?: number | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  metadata?: Record<string, any>;
}

export interface RedeemPointsInput {
  contactId: string;
  points: number;
  voucherType: LoyaltyVoucherType;
  value?: number | null;
  benefitCode?: string | null;
  expiresAt?: Date | null;
}

export interface EarnFromPaymentInput {
  contactId: string;
  amount: number; // valor da transação
  channel: 'PDV' | 'MARKETPLACE' | 'VENUE' | 'EVENT';
  actorId?: string;
  referenceType: string;
  referenceId: string;
  orderId?: string;
  productVariantId?: string;
  categoryId?: string;
}

export interface LoyaltyLedgerFilters {
  contactId: string;
  limit?: number;
  offset?: number;
}

export interface LoyaltyRuleFilters {
  status?: LoyaltyRuleStatus;
  appliesTo?: LoyaltyRuleAppliesTo;
  appliesId?: string;
  limit?: number;
  offset?: number;
}





