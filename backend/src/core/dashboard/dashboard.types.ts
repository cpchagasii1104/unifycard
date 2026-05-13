// src/core/dashboard/dashboard.types.ts

import type { IdentityProfile } from '../identity/identity.types';

export interface DashboardWallet {
  balanceCents: number;
  currency: string;
  totalInCents: number;
  totalOutCents: number;
  lastTransactions: Array<{
    transactionId: string;
    type: 'credit' | 'debit';
    amountCents: number;
    createdAt: string;
  }>;
}

export interface DashboardData {
  profile: {
    global: IdentityProfile['global'];
    local: IdentityProfile['local'];
    residence: IdentityProfile['residence'];
  };
  wallet: DashboardWallet | null;
  reputation: IdentityProfile['reputation'] | null;
  /** Legado regional fund removido — sempre null até read model em bank_* */
  fund: null;
}












