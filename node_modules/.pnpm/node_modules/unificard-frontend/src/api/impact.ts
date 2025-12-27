// src/api/impact.ts
// API para Impacto Real + Ledger por Ator (FASE 10)

import { apiFetch } from './client';

export interface ImpactBalance {
  actor_id: string;
  actor_type: 'user' | 'page';
  balance: number;
}

export interface ImpactLedgerEntry {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'page';
  event_type: 'LIKE' | 'SUPPORT' | 'JOIN_GROUP' | 'POST_PUBLISHED';
  impact_delta: number;
  source_type: 'post' | 'group' | 'project' | 'system';
  source_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Busca saldo de impacto do ator ativo
 */
export async function getImpactBalance(
  actorId: string,
  actorType: 'user' | 'page'
): Promise<ImpactBalance> {
  const queryParams = new URLSearchParams();
  queryParams.append('actor_id', actorId);
  queryParams.append('actor_type', actorType);

  const response = await apiFetch(`/social/impact/balance?${queryParams.toString()}`);
  return response.json();
}

/**
 * Busca histórico do ledger de impacto (extrato)
 */
export async function getImpactLedger(
  actorId: string,
  actorType: 'user' | 'page',
  limit: number = 20
): Promise<{ entries: ImpactLedgerEntry[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('actor_id', actorId);
  queryParams.append('actor_type', actorType);
  queryParams.append('limit', limit.toString());

  const response = await apiFetch(`/social/impact/ledger?${queryParams.toString()}`);
  return response.json();
}

