// src/api/actor-page.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — client do contrato server-driven da página do actor.
// O backend DESCREVE a página (header/actions/tabs/blocks); o cliente só renderiza.
// Frontend nunca decide quais abas acendem nem habilita ação gated (frontend não cria verdade).

import { apiFetchJson } from './client';

export type ActorPageMode = 'consuming' | 'operating';

export interface ActorPageHeader {
  actorId: string;
  displayName: string;
  actorType: string;
  slug: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  headline: string | null;
}

export interface ActorPageAction {
  key: string;
  label: string;
  enabled: boolean;
  gatedBy?: string;
  deeplink: string | null;
  data?: { allowedLabels?: string[] } & Record<string, unknown>;
}

export interface ActorPageTab {
  key: string;
  label: string;
}

export interface ActorPageBlock {
  type: string;
  tab: string;
  deeplink: string | null;
  data: { count?: number; bio?: string | null; headline?: string | null } & Record<string, unknown>;
}

export interface ActorPageContract {
  actorId: string;
  mode: ActorPageMode;
  header: ActorPageHeader;
  actions: ActorPageAction[];
  tabs: ActorPageTab[];
  blocks: ActorPageBlock[];
}

export async function getActorPage(actorId: string, mode: ActorPageMode = 'consuming'): Promise<ActorPageContract> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorPageContract }>(
    `/actor-page/${actorId}?mode=${mode}`
  );
  return res.data;
}
