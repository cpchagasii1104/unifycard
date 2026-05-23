// src/core/identity/identity.types.ts

export interface GlobalUser {
  globalUserId: string;
  createdAt: string;
  updatedAt: string;
  fullName: string | null;
  avatarUrl: string | null;
  birthdate: Date | null;
  metadata: Record<string, any>;
}

export interface GlobalUserRow {
  global_user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  full_name: string | null;
  avatar_url: string | null;
  birthdate: Date | string | null; // PostgreSQL pode retornar como string YYYY-MM-DD
  metadata: Record<string, any>;
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
    createdAt: string;
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
    balanceCents: number;
    currency: string;
    totalIn: number;
    totalOut: number;
    lastTransactions: Array<{
      transactionId: string;
      type: 'credit' | 'debit';
      amountCents: number;
      createdAt: string;
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




