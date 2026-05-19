// src/api/active-location.ts
// API client para localização ativa do actor.
// Backend: /me/active-location (F4 do plano feed geo, DECISION-0030).
//
// Princípio "Frontend nunca cria verdade":
//   - Frontend envia inputs; backend resolve.
//   - lat/lng NUNCA persistidos em localStorage (LGPD).
//   - Esta camada apenas chama HTTP — sem cache de localização.

import { apiFetch } from './client';

export type ActorActiveLocationSource =
  | 'USER_INPUT_CITY'
  | 'BROWSER_GEOLOCATION'
  | 'IP_ESTIMATE'
  | 'EXPLICIT_TRAVEL_MODE';

export type ScopeLevel = 'NEIGHBORHOOD' | 'CITY' | 'STATE' | 'COUNTRY';

export interface ActiveLocation {
  id: string;
  tenantId: string;
  actorId: string;
  addressId: string | null;
  lat: number | null;
  lng: number | null;
  source: ActorActiveLocationSource;
  scopeLevel: ScopeLevel | null;
  activatedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SetActiveLocationInput {
  /** Pelo menos um obrigatório: address_id OU (lat AND lng) */
  address_id?: string;
  lat?: number;
  lng?: number;
  source: ActorActiveLocationSource;
  scope_level?: ScopeLevel;
  expires_at?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Busca localização ativa do actor atual.
 * Retorna null se actor não tem localização ativa.
 */
export async function getActiveLocation(): Promise<ActiveLocation | null> {
  try {
    const response = await apiFetch('/me/active-location');
    if (!response.ok) return null;
    const data = await response.json();
    return data.location ?? null;
  } catch (error) {
    console.warn('[ActiveLocation] Erro ao buscar:', error);
    return null;
  }
}

/**
 * Define localização ativa do actor (set).
 * Substitui anterior (idempotente backend-side).
 */
export async function setActiveLocation(
  input: SetActiveLocationInput
): Promise<ActiveLocation> {
  const response = await apiFetch('/me/active-location', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await response.json();
  return data.location;
}

/**
 * Limpa localização ativa do actor (clear).
 * Preserva histórico server-side. Idempotente.
 */
export async function clearActiveLocation(): Promise<void> {
  await apiFetch('/me/active-location', { method: 'DELETE' });
}
