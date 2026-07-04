// src/api/public-profiles.ts
// F-DISCOVERY-PUBLIC-PROFILE-SLICE-B — client da vitrine (plaquinha pública do actor ativo).
// O actor NUNCA é enviado pelo cliente como autoridade: o backend usa actionContext + prova
// canRepresentActor server-side (DECISION-0113). Fase 1: 'public' | 'private' ("só eu").
// (frontend nunca cria verdade — o toggle lê GET /mine e grava via POST /publish; zero localStorage)

import { apiFetchJson } from './client';

export type PublishVisibility = 'public' | 'private';

export interface MyPublicProfile {
  id: string;
  tenantId: string;
  actorId: string;
  profileType: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  visibility: 'public' | 'private' | 'followers_only';
  createdAt: string;
  updatedAt: string;
}

/** A plaquinha do actor ativo (null se nunca publicou). */
export async function getMyPublicProfile(): Promise<MyPublicProfile | null> {
  const res = await apiFetchJson<{ ok: boolean; data: MyPublicProfile | null }>('/public-profiles/mine');
  return res.data;
}

/**
 * Projeção pública de UM perfil da vitrine (destino do clique no hit global da busca). Só a
 * plaquinha — nunca PII/tenant/dinheiro. Cross-tenant por design. null (404) se não for público.
 */
export interface GlobalPublicProfile {
  actorId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  profileType: 'user' | 'page' | 'group' | 'cultural_profile';
  headline: string | null;
  link: string | null;
}

/** Cartão público: o que o usuário escolheu mostrar na sua página da vitrine. */
export interface PublicCard {
  showAvatar: boolean;
  showBio: boolean;
  headline: string | null;
  link: string | null;
}

/** Lê o cartão atual (o que aparece hoje na página pública). */
export async function getMyPublicCard(): Promise<PublicCard> {
  const res = await apiFetchJson<{ ok: boolean; data: PublicCard }>('/public-profiles/mine/card');
  return res.data;
}

/** Salva a escolha do usuário (o que aparece na página pública). Anti-PII no backend. */
export async function updateMyPublicCard(card: PublicCard): Promise<void> {
  await apiFetchJson('/public-profiles/mine/card', { method: 'PUT', body: JSON.stringify(card) });
}

export async function getGlobalPublicProfile(actorId: string): Promise<GlobalPublicProfile | null> {
  try {
    const res = await apiFetchJson<{ ok: boolean; data: GlobalPublicProfile }>(`/public-profiles/global/${actorId}`);
    return res.data;
  } catch {
    return null; // 404 (não publicou público) ou erro → sem plaquinha
  }
}

/** Publica ('public' = achável por todos) ou despublica ('private' = só eu) a plaquinha. */
export async function publishMyProfile(visibility: PublishVisibility): Promise<MyPublicProfile> {
  const res = await apiFetchJson<{ ok: boolean; data: MyPublicProfile }>('/public-profiles/publish', {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
  return res.data;
}
