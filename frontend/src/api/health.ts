// src/api/health.ts
// API de Health (Health Facts do Perfil + Health Check do Backend)

import { apiFetch, apiFetchJson } from './client';

// ============================================================
// HEALTH CHECK DO BACKEND
// ============================================================

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  canonical_permissions_version?: string;
  modules?: {
    marketplace?: 'ok' | 'error';
    social?: 'ok' | 'error';
    bank?: 'ok' | 'error';
  };
  runtime?: {
    pid: number;
    nodeVersion: string;
    platform: string;
    arch: string;
    port: number | null;
    env: string;
  };
  database?: {
    connected: boolean;
    host?: string;
    port?: number;
    database?: string;
    schema?: string;
    user?: string;
    connectionCount?: number;
  };
}

/**
 * Verifica se o backend está online
 * Retorna null se backend estiver offline (não lança erro)
 */
export async function checkBackendHealth(): Promise<HealthStatus | null> {
  try {
    const health = await apiFetchJson<HealthStatus>('/health', {
      method: 'GET',
    });
    return health;
  } catch (err: any) {
    // Backend offline - retornar null sem lançar erro
    if (err.code === 'BACKEND_OFFLINE' || err.isRetryable) {
      return null;
    }
    // Outros erros - propagar
    throw err;
  }
}

// ============================================================
// HEALTH FACTS DO PERFIL (Profile Health)
// ============================================================

export type HealthSection = 'general' | 'vision' | 'dental' | 'hearing' | 'mobility' | 'mental' | 'chronic' | 'medications' | 'allergies' | 'other';

export interface HealthTaxonomy {
  taxonomyId: string;
  name: string;
  slug: string;
  category: string;
  factType: 'text' | 'number' | 'boolean' | 'date' | 'device';
  parentId?: string;
  isActive: boolean;
}

export interface UserHealthFact {
  factId: string;
  taxonomyId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  notes?: string | null;
  taxonomy?: HealthTaxonomy | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Busca taxonomias de saúde disponíveis
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico de health mantido
 * Backend já usa adapter sobre categories core
 */
export async function getHealthTaxonomies(category?: string): Promise<HealthTaxonomy[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const response = await apiFetchJson<{ ok: boolean; data: HealthTaxonomy[] }>(`/profile/health/taxonomies${query}`);
  return response.data || [];
}

/**
 * Busca fatos de saúde do usuário
 */
export async function getHealthFacts(category?: string): Promise<UserHealthFact[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const response = await apiFetchJson<{ ok: boolean; data: UserHealthFact[] }>(`/profile/health/facts${query}`);
  return response.data || [];
}

/**
 * Cria ou atualiza fato de saúde
 */
export async function upsertHealthFact(input: {
  taxonomyId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  notes?: string | null;
}): Promise<UserHealthFact> {
  const response = await apiFetchJson<{ ok: boolean; data: UserHealthFact }>('/profile/health/facts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

/**
 * Remove fato de saúde
 */
export async function deleteHealthFact(factId: string): Promise<void> {
  await apiFetch(`/profile/health/facts/${factId}`, {
    method: 'DELETE',
  });
}
