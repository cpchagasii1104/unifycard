// frontend/src/api/profile-inference.ts
// 2026-05-18 P2 — Profile Inference API client
//
// Consume GET /actors/:actorId/inferred-profile do backend.
// Princípio: frontend NÃO infere nada — só renderiza projeção que veio do
// backend (que agregou de SSOT existentes).

import { apiFetch, extractErrorMessage } from './client';

export interface EventTypeAffinity {
  eventType: string;
  eventSubtype: string | null;
  attendanceCount: number;
  lastAttendanceAt: string;
}

export interface CommunityMembership {
  groupId: string;
  groupName: string;
  role: string;
  joinedAt: string;
}

export interface InferredProfileResponse {
  actorId: string;
  eventTypeAffinities: EventTypeAffinity[];
  communities: CommunityMembership[];
  windowDaysEvents: number;
  resolvedAt: string;
  source: 'mvp-events-and-communities';
}

/**
 * Busca perfil inferido (afinidades + comunidades) para um actor.
 * Backend valida authority via capability resolver. 403 se sem authority.
 */
export async function getInferredProfile(
  actorId: string,
  options?: { windowDaysEvents?: number; limitAffinities?: number; limitCommunities?: number }
): Promise<InferredProfileResponse> {
  const params = new URLSearchParams();
  if (options?.windowDaysEvents) params.append('windowDaysEvents', String(options.windowDaysEvents));
  if (options?.limitAffinities) params.append('limitAffinities', String(options.limitAffinities));
  if (options?.limitCommunities) params.append('limitCommunities', String(options.limitCommunities));
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await apiFetch(`/actors/${encodeURIComponent(actorId)}/inferred-profile${qs}`, {}, { silent401: true });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        actorId,
        eventTypeAffinities: [],
        communities: [],
        windowDaysEvents: 180,
        resolvedAt: new Date().toISOString(),
        source: 'mvp-events-and-communities',
      };
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar perfil inferido: ${response.status}`));
  }
  return await response.json();
}
