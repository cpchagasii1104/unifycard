// src/utils/service-orders-helpers.ts
// Helpers para buscar nomes de serviços e atores
// SPRINT 68: Service Orders + Agenda - Ajustes UX

import { apiFetch, apiFetchJson } from '../api/client';
import { getActorProfile } from '../api/social-2.0';

export interface ServiceInfo {
  id: string;
  name: string | null;
}

export interface ActorInfo {
  id: string;
  name: string | null;
}

// Cache simples para evitar múltiplas chamadas
const serviceCache = new Map<string, ServiceInfo>();
const actorCache = new Map<string, ActorInfo>();

/**
 * Busca nome do serviço por ID
 */
export async function getServiceName(serviceId: string): Promise<string | null> {
  if (serviceCache.has(serviceId)) {
    return serviceCache.get(serviceId)?.name || null;
  }

  try {
    const response = await apiFetch(`/services/${serviceId}`);
    if (!response.ok) {
      return null;
    }
    const result = await response.json();
    // Backend retorna { ok: true, data: Service } ou Service diretamente
    const service = result.data || result;
    const name = service.name || null;
    serviceCache.set(serviceId, { id: serviceId, name });
    return name;
  } catch {
    // Se não conseguir buscar, retorna null (não quebra o fluxo)
    return null;
  }
}

/**
 * Busca nome do actor por ID
 */
export async function getActorName(actorId: string): Promise<string | null> {
  if (actorCache.has(actorId)) {
    return actorCache.get(actorId)?.name || null;
  }

  try {
    const profile = await getActorProfile(actorId);
    // ActorProfile tem { actor: { display_name, ... } }
    const name = profile.actor?.display_name || null;
    actorCache.set(actorId, { id: actorId, name });
    return name;
  } catch {
    // Se não conseguir buscar, retorna null (não quebra o fluxo)
    return null;
  }
}

/**
 * Formata exibição: nome (se disponível) ou UUID parcial
 */
export function formatEntityDisplay(id: string, name: string | null | undefined): string {
  if (name) {
    return `${name} (${id.substring(0, 8)}...)`;
  }
  return `${id.substring(0, 8)}...`;
}

/**
 * Id curto para projeção amigável na UI. O UUID completo permanece disponível
 * (title/console) — aqui só encurtamos a exibição. NÃO altera payload nem semântica.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 8 ? `#${id.substring(0, 8)}` : `#${id}`;
}

/**
 * Limpa cache (útil para testes ou refresh)
 */
export function clearCache(): void {
  serviceCache.clear();
  actorCache.clear();
}

