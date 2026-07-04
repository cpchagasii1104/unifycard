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

/** Publica ('public' = achável por todos) ou despublica ('private' = só eu) a plaquinha. */
export async function publishMyProfile(visibility: PublishVisibility): Promise<MyPublicProfile> {
  const res = await apiFetchJson<{ ok: boolean; data: MyPublicProfile }>('/public-profiles/publish', {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
  return res.data;
}
