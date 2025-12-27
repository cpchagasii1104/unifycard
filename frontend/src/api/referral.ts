// src/api/referral.ts
// API de código de indicação/afiliado

import { apiFetch } from './client';

export interface ReferralCodeResponse {
  referralCode: string;
}

export interface ApplyReferralCodeRequest {
  referralCode: string;
}

export interface ApplyReferralCodeResponse {
  referrerUserId: string;
}

export async function getReferralCode(): Promise<ReferralCodeResponse> {
  const response = await apiFetch('/referral/code');
  return response.json();
}

export async function applyReferralCode(referralCode: string): Promise<ApplyReferralCodeResponse> {
  const response = await apiFetch('/referral/apply', {
    method: 'POST',
    body: JSON.stringify({ referralCode }),
  });
  return response.json();
}

