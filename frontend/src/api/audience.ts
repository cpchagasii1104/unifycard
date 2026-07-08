// frontend/src/api/audience.ts
// CLIENT ÚNICO da capacidade transversal de PLATEIA (Clayton 2026-07-07: "fonte única para TODAS as
// opções"). Toda tela que pergunta "1 · Para quem é isso?" (post, evento, locação, demanda,
// oportunidade) consome ISTO — nunca uma lista hardcoded local. A verdade nasce das RELAÇÕES do
// actor (backend deriva de PAIR_ALLOWED_LABELS). Muda por ACTOR, nunca por modo operante.

import { apiFetchJson } from './client';

export interface AudienceOption {
  key: string;
  label: string;
  icon: string;
  visibility: 'public' | 'connections' | 'only_me';
  /** Refinamento por tipo de relação (⊆ labels típados). null = macro (sem refinamento). */
  audienceRelationshipTypes: string[] | null;
}

/**
 * Opções de plateia para o actor ativo (server-driven, autoridade validada no backend).
 * O actor vem do actionContext (header) que o apiFetch canônico já injeta.
 */
export async function getAudienceOptions(): Promise<{ actorType: string; options: AudienceOption[] }> {
  const r = await apiFetchJson<{ ok: boolean; data: { actorType: string; options: AudienceOption[] } }>(
    '/audience-options'
  );
  return r.data;
}
