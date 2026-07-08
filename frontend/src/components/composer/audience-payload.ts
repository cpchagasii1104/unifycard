// frontend/src/components/composer/audience-payload.ts
// Helper PURO seleção→payload (Clayton 2026-07-07). Não cria verdade: só transforma as options que
// VIERAM do backend + as keys selecionadas em { visibility, audienceRelationshipTypes }. Zero lista
// local — "exclusiva vs combinável" é DERIVADO do shape (audienceRelationshipTypes === null).
import type { AudienceOption } from '../../api/audience';

/** Exclusiva = escopo completo (public/connections/only_me): audienceRelationshipTypes é null. */
export const isExclusive = (o: AudienceOption): boolean => o.audienceRelationshipTypes == null;

export interface AudiencePayload {
  visibility: 'public' | 'connections' | 'only_me';
  audienceRelationshipTypes: string[] | null;
}

/**
 * Resolve as keys selecionadas em payload. Regras:
 *  - se há uma EXCLUSIVA selecionada → { visibility dela, types: null } (a 1ª exclusiva encontrada).
 *  - se há COMBINÁVEIS → { visibility: 'connections', types: UNION+DEDUPE de todos os labels }.
 *  - vazio → default seguro (public se existir nas options; senão a 1ª exclusiva; senão public puro).
 * Nunca inventa opção que não veio do backend.
 */
export function resolveAudiencePayload(options: AudienceOption[], selectedKeys: string[]): AudiencePayload {
  const byKey = new Map(options.map((o) => [o.key, o]));
  const selected = selectedKeys.map((k) => byKey.get(k)).filter((o): o is AudienceOption => !!o);

  const exclusive = selected.find(isExclusive);
  if (exclusive) return { visibility: exclusive.visibility, audienceRelationshipTypes: null };

  const combinables = selected.filter((o) => !isExclusive(o));
  if (combinables.length > 0) {
    // UNION + DEDUPE — não assume 1 label por opção (item 3: opção composta futura funciona).
    const labels = Array.from(new Set(combinables.flatMap((o) => o.audienceRelationshipTypes ?? [])));
    return { visibility: 'connections', audienceRelationshipTypes: labels };
  }

  // Vazio → fallback seguro derivado das options (item 4: nunca inventa).
  const publicOpt = options.find((o) => o.key === 'public');
  if (publicOpt) return { visibility: publicOpt.visibility, audienceRelationshipTypes: null };
  const firstExclusive = options.find(isExclusive);
  if (firstExclusive) return { visibility: firstExclusive.visibility, audienceRelationshipTypes: null };
  return { visibility: 'public', audienceRelationshipTypes: null };
}

/**
 * Reduz um clique numa opção às novas keys selecionadas (regra exclusiva vs combinável).
 *  - clicou exclusiva → só ela.
 *  - clicou combinável → tira exclusivas, faz toggle dela (acumula com outras combináveis).
 *  - se desmarcou a última combinável → volta pra 'public' quando existir (senão vazio → resolve fallback).
 */
export function toggleAudienceKey(options: AudienceOption[], selectedKeys: string[], clickedKey: string): string[] {
  const byKey = new Map(options.map((o) => [o.key, o]));
  const clicked = byKey.get(clickedKey);
  if (!clicked) return selectedKeys;

  if (isExclusive(clicked)) return [clickedKey];

  const combinables = selectedKeys.filter((k) => { const o = byKey.get(k); return o && !isExclusive(o); });
  const next = combinables.includes(clickedKey)
    ? combinables.filter((k) => k !== clickedKey)   // toggle off
    : [...combinables, clickedKey];                  // toggle on
  if (next.length === 0) {
    return options.some((o) => o.key === 'public') ? ['public'] : [];
  }
  return next;
}
