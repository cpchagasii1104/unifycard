// src/api/economy.ts
// API de Economy (contas, transações)

import { apiFetch } from './client';

// Conformidade §4.7: campos monetários com sufixo `_cents` alinhados ao backend
// (core/economy/accounts/account.routes.ts /me retorna `balanceCents`).
export interface UserAccount {
  accountId: string;
  balanceCents: number;
  currency: string;
  status: 'active' | 'inactive' | 'suspended';
}

/**
 * Busca conta do usuário autenticado
 * Usa GET /economy/accounts/me (CORE ECONOMY)
 * Trata 404 como feature indisponível (não erro)
 */
export async function getMyAccount(): Promise<UserAccount | null> {
  try {
    const response = await apiFetch('/economy/accounts/me', {}, { silent404: true });
    return await response.json();
  } catch (error: any) {
    // Se 404, tratar como feature indisponível (não erro)
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 404) {
      return null; // Wallet não disponível
    }
    throw error; // Outros erros devem ser propagados
  }
}

