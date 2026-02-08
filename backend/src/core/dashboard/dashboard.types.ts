// src/core/dashboard/dashboard.types.ts

import type { IdentityProfile } from '../identity/identity.types';
import type { RegionalFundView } from '../economy/fund/fund.types';

export interface DashboardWallet {
  balance: number;
  currency: string;
  totalIn: number;
  totalOut: number;
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
  fund: RegionalFundView | null;
}












