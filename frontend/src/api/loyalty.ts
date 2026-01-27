// frontend/src/api/loyalty.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import { apiFetch, apiFetchJson } from './client';

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  contactId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  tenantId: string;
  contactId: string;
  entryType: 'EARN' | 'REDEEM' | 'ADJUST';
  points: number;
  referenceType: string | null;
  referenceId: string | null;
  reasonCode: string | null;
  description: string | null;
  createdByActorId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface LoyaltyVoucher {
  id: string;
  tenantId: string;
  contactId: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  voucherType: 'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'BENEFIT_FLAG';
  value: number | null;
  benefitCode: string | null;
  expiresAt: string | null;
  createdFromLedgerId: string | null;
  usedReferenceType: string | null;
  usedReferenceId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  usedAt: string | null;
}

export async function getLoyaltyAccount(contactId: string): Promise<LoyaltyAccount> {
  const response = await apiFetch(`/loyalty/account?contactId=${contactId}`);
  return await response.json();
}

export async function listLoyaltyLedger(
  contactId: string,
  limit?: number,
  offset?: number
): Promise<LoyaltyLedgerEntry[]> {
  const params = new URLSearchParams();
  params.append('contactId', contactId);
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());

  const response = await apiFetch(`/loyalty/ledger?${params.toString()}`);
  const data = await response.json();
  return data.entries || [];
}

export async function redeemPoints(input: {
  contactId: string;
  points: number;
  voucherType: 'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'BENEFIT_FLAG';
  value?: number | null;
  benefitCode?: string | null;
  expiresAt?: string | null;
}): Promise<{ voucher: LoyaltyVoucher; newBalance: number }> {
  return await apiFetchJson('/loyalty/redeem', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listLoyaltyVouchers(
  contactId: string,
  status?: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED'
): Promise<LoyaltyVoucher[]> {
  const params = new URLSearchParams();
  params.append('contactId', contactId);
  if (status) params.append('status', status);

  const response = await apiFetch(`/loyalty/vouchers?${params.toString()}`);
  const data = await response.json();
  return data.vouchers || [];
}





