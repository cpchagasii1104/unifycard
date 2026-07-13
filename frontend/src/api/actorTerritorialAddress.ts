// src/api/actorTerritorialAddress.ts
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — client canônico da jornada PF/residência.
//
// Preview via o resolver canônico da Fase B (GET /locations/cep?countryCode=BR) — NUNCA a facade
// textual /api/location/cep. Comando/leitura via /actors/:actorId/territorial-address (writer C).
// Preserva IDs canônicos (cityId/neighborhoodId); país SEMPRE explícito.

import { apiFetch, apiFetchJson } from './client';
import type {
  PostalAddressPreview,
  SetTerritorialAddressCommand,
  TerritorialAddressWriteResult,
  TerritorialAddressCurrent,
  TerritorialAddressErrorCode,
} from '@unificard/contracts';

/** Shape flat seguro devolvido por GET /locations/cep (já sem provider internals). */
interface CanonicalCepData {
  resolved: boolean;
  postalCode: string | null;
  street: string | null;
  neighborhoodDisplay: string | null;
  neighborhoodId: string | null;
  cityId: string | null;
  cityName: string | null;
  stateUf: string | null;
  source: string | null;
}

export type PostalPreviewResult =
  | { ok: true; preview: PostalAddressPreview }
  | { ok: false; code: 'canonical_city_missing' | 'unresolved' };

/**
 * Preview postal canônico (país EXPLÍCITO). Mapeia a projeção flat segura para o DTO estreito
 * nested `PostalAddressPreview`. Nunca expõe provider internals (a rota já os oculta).
 */
export async function previewResidenceAddress(countryCode: string, rawCep: string): Promise<PostalPreviewResult> {
  const cep = rawCep.replace(/\D/g, '');
  const res = await apiFetchJson<{ ok: boolean; data: CanonicalCepData }>(
    `/locations/cep/${encodeURIComponent(cep)}?countryCode=${encodeURIComponent(countryCode.toUpperCase())}`,
  );
  const d = res?.data;
  if (!d || !d.resolved || !d.cityId) {
    return { ok: false, code: 'unresolved' };
  }
  const neighborhoodStatus: PostalAddressPreview['neighborhood']['status'] = d.neighborhoodId
    ? 'resolved'
    : d.neighborhoodDisplay
      ? 'pending'
      : 'not_applicable';
  const preview: PostalAddressPreview = {
    status: 'resolved',
    country: { id: '', code: countryCode.toUpperCase(), displayName: countryCode.toUpperCase() },
    state: { id: '', code: d.stateUf ?? '', displayName: d.stateUf ?? '' },
    city: { id: d.cityId, displayName: d.cityName ?? '' },
    neighborhood: {
      id: d.neighborhoodId,
      candidateId: null,
      status: neighborhoodStatus,
      displayName: d.neighborhoodDisplay,
    },
    postalCode: d.postalCode ?? cep,
    street: d.street,
    requiresUserConfirmation: true,
  };
  return { ok: true, preview };
}

export type SetResidenceResult =
  | { ok: true; result: TerritorialAddressWriteResult }
  | { ok: false; code: TerritorialAddressErrorCode; status: number };

/** POST /actors/:actorId/territorial-address — set/replace via writer selado da Fase C. */
export async function setActorResidenceAddress(
  actorId: string,
  command: SetTerritorialAddressCommand,
): Promise<SetResidenceResult> {
  const response = await apiFetch(`/actors/${encodeURIComponent(actorId)}/territorial-address`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
  if (response.ok) {
    const result = (await response.json()) as TerritorialAddressWriteResult;
    return { ok: true, result };
  }
  let code: TerritorialAddressErrorCode = 'unexpected_error';
  try {
    const body = (await response.json()) as { error?: TerritorialAddressErrorCode };
    if (body?.error) code = body.error;
  } catch {
    /* corpo não-JSON */
  }
  return { ok: false, code, status: response.status };
}

/** GET /actors/:actorId/territorial-address?purpose=ACTOR_RESIDENCE — leitura do vigente. */
export async function getActorResidenceAddress(actorId: string): Promise<TerritorialAddressCurrent | null> {
  const res = await apiFetch(
    `/actors/${encodeURIComponent(actorId)}/territorial-address?purpose=ACTOR_RESIDENCE`,
    { method: 'GET' },
  );
  if (!res.ok) return null;
  return (await res.json()) as TerritorialAddressCurrent;
}
