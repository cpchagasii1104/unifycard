// src/api/economy.ts
// API de Economy (contas, transações)

import { apiFetch } from './client';

export interface UserAccount {
  accountId: string;
  balance: number;
  currency: string;
  status: 'active' | 'inactive' | 'suspended';
}

/**
 * Busca conta do usuário autenticado
 * Usa GET /economy/accounts/me (CORE ECONOMY)
 */
export async function getMyAccount(): Promise<UserAccount> {
  const response = await apiFetch('/economy/accounts/me');
  return response.json();
}

