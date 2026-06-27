// frontend/src/api/canonical-services.ts
// Leitura do CATÁLOGO CANÔNICO de serviços (governado). O membro que opera-como-a-empresa escolhe
// um serviço canônico existente para criar seu service/oferta. Frontend PROJETA verdade resolvida —
// NÃO cria taxonomia canônica (catálogo é governado no backend; aqui só busca o que já existe).

import { apiFetchJson } from './client';

export interface CanonicalService {
  id: string;
  conceptId: string | null;
  name: string;
  slug: string | null;
  scope?: string | null;
  status?: string | null;
}

/**
 * Busca serviços canônicos VISÍVEIS para o tenant (catálogo governado).
 * GET /catalog/governance/services/search?q= → { ok, data: CanonicalService[] }.
 */
export async function searchCanonicalServices(q: string): Promise<CanonicalService[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await apiFetchJson<{ ok: boolean; data: CanonicalService[] }>(
    `/catalog/governance/services/search${query}`
  );
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

/**
 * Busca serviços canônicos que o ACTOR ATIVO PODE PUBLICAR AGORA (F-MVP-...-OFFERABLE-AUTOCOMPLETE, Opção A).
 * GET /catalog/governance/services/offerable?q= → { ok, data: CanonicalService[] }.
 * A elegibilidade (concept declarado no Profissional/C1 ou publicado pela empresa, ATIVO) é resolvida no
 * BACKEND com o MESMO predicado do gate DECISION-0144. O frontend NÃO cruza listas nem replica a lógica
 * PF/PJ — só projeta a verdade resolvida pelo servidor. O actor ativo viaja no x-action-context (apiFetch).
 */
export async function searchOfferableCanonicalServices(q: string): Promise<CanonicalService[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await apiFetchJson<{ ok: boolean; data: CanonicalService[] }>(
    `/catalog/governance/services/offerable${query}`
  );
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}
