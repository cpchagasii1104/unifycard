// src/api/dashboard.ts
// API do dashboard principal

import { apiFetch } from './client';
import type { IdentityProfile } from './identity';
import type { RegionalFundView } from './fund';

export interface DashboardWallet {
  balance: number;
  currency: string;
  totalIn: number;
  totalOut: number;
  lastTransactions: Array<{
    transactionId: string;
    type: 'credit' | 'debit';
    amount: number;
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

export async function getDashboard(): Promise<DashboardData> {
  const response = await apiFetch('/dashboard');
  return response.json();
}

