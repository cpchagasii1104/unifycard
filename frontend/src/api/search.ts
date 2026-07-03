// src/api/search.ts
// F-GLOBAL-SEARCH-OMNI Slice B — client do omnibox federado (GET /search?q=, §9.3 nomenclatura).
// O frontend CONSOME as seções resolvidas pelo backend (projeção): quem aparece, visibilidade,
// eligibility e piso de discovery são decididos server-side. Aqui só se renderiza e navega.
// (frontend nunca cria verdade)

import { apiFetchJson } from './client';

export interface OmniIdentityHit {
  actorId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface OmniGroupHit {
  groupId: string;
  name: string;
}

export interface OmniEventHit {
  eventId: string;
  title: string;
  datetimeStart: string | null;
  status: string;
}

export interface OmniProductHit {
  canonicalProductId: string;
  name: string;
  brand: string | null;
}

// resultado de serviço = DTO vivo da discovery (chave serviceId; ver api/services.ts)
export interface OmniServiceHit {
  serviceId: string;
  name: string;
}

export interface OmniSearchResult {
  q: string;
  sections: {
    people: OmniIdentityHit[];
    companies: OmniIdentityHit[];
    groups: OmniGroupHit[];
    services: { conceptIds: string[]; results: OmniServiceHit[] };
    products: OmniProductHit[];
    events: OmniEventHit[];
  };
  sectionErrors: string[];
}

export async function searchOmni(q: string, limit = 5): Promise<OmniSearchResult> {
  const res = await apiFetchJson<{ ok: boolean; data: OmniSearchResult }>(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
  return res.data;
}
