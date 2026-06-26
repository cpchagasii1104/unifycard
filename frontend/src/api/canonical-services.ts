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
