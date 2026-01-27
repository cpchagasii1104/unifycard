// backend/src/modules/presence/presence.types.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

export type PresenceContextType = 'EVENT' | 'VENUE';
export type PresenceRsvpStatus = 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
export type PresenceVisibility = 'PRIVATE' | 'PUBLIC';
export type CheckinTokenStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type CheckinType = 'QR' | 'MANUAL';
export type CheckinStatus = 'CHECKED_IN' | 'CHECKED_OUT';
export type PromoBenefitType = 'LOYALTY_POINTS' | 'LOYALTY_MULTIPLIER' | 'VOUCHER';
export type PromoBenefitStatus = 'ACTIVE' | 'INACTIVE';

export interface PresenceRsvp {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
  status: PresenceRsvpStatus;
  visibility: PresenceVisibility;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  attendedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckinToken {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  token: string;
  status: CheckinTokenStatus;
  validFrom: Date | null;
  validTo: Date | null;
  createdByActorId: string | null;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Checkin {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
  tokenId: string | null;
  checkinType: CheckinType;
  status: CheckinStatus;
  referenceEventId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface PromoBenefit {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  benefitType: PromoBenefitType;
  benefitValue: number;
  status: PromoBenefitStatus;
  requiresCheckin: boolean;
  maxRedemptions: number | null;
  perContactLimit: number;
  validFrom: Date | null;
  validTo: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface PromoBenefitRedemption {
  id: string;
  tenantId: string;
  benefitId: string;
  contactId: string;
  checkinId: string | null;
  loyaltyLedgerId: string | null;
  voucherId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ConfirmPresenceInput {
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
  visibility?: PresenceVisibility;
}

export interface CreateCheckinTokenInput {
  contextType: PresenceContextType;
  contextId: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  metadata?: Record<string, any>;
}

export interface CheckInByTokenInput {
  token: string;
  contactId: string;
  referenceEventId?: string | null;
}

export interface ManualCheckInInput {
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
}

export interface CreatePromoBenefitInput {
  contextType: PresenceContextType;
  contextId: string;
  benefitType: PromoBenefitType;
  benefitValue: number;
  requiresCheckin?: boolean;
  maxRedemptions?: number | null;
  perContactLimit?: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  metadata?: Record<string, any>;
}

export interface AttendanceStats {
  confirmed: number;
  attended: number;
  noShow: number;
  noShowRate: number; // percentage
  cancelled: number;
}

export interface PresenceFilters {
  status?: PresenceRsvpStatus;
  visibility?: PresenceVisibility;
  limit?: number;
  offset?: number;
}





