// src/core/identity/identity.types.ts

export interface GlobalUser {
  globalUserId: string;
  createdAt: Date;
  updatedAt: Date;
  fullName: string | null;
  avatarUrl: string | null;
  birthdate: Date | null;
  metadata: Record<string, any>;
}

export interface GlobalUserRow {
  global_user_id: string;
  created_at: Date;
  updated_at: Date;
  full_name: string | null;
  avatar_url: string | null;
  birthdate: Date | null;
  metadata: Record<string, any>;
}

export interface UserIdentityLink {
  id: string;
  globalUserId: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
}

export interface UserIdentityLinkRow {
  id: string;
  global_user_id: string;
  user_id: string;
  tenant_id: string;
  created_at: Date;
}

export interface UpdateGlobalIdentityInput {
  fullName?: string | null;
  avatarUrl?: string | null;
  birthdate?: Date | null;
  metadata?: Record<string, any>;
}

export interface IdentityProfile {
  global: GlobalUser;
  local: {
    userId: string;
    tenantId: string;
    email: string;
    createdAt: Date;
    plan?: 'free' | 'pro' | 'enterprise';
    isTest?: boolean;
  };
  reputation?: {
    scores: {
      global: number;
      work?: number;
      rides?: number;
      events?: number;
      commerce?: number;
    };
    summary: {
      totalReviews: number;
      lastReviewAt?: string;
      averageScore: number;
    };
  };
  wallet?: {
    balance: number;
    currency: string;
    totalIn: number;
    totalOut: number;
    lastTransactions: Array<{
      transactionId: string;
      type: 'credit' | 'debit';
      amount: number;
      createdAt: Date;
    }>;
  };
  residence?: {
    country: {
      countryId: string;
      name: string;
      code: string;
    } | null;
    state: {
      stateId: string;
      name: string;
      code: string;
    } | null;
    city: {
      cityId: string;
      name: string;
    } | null;
    timezone: string | null;
    currency: string;
    languages: string[];
  };
}

