// src/hooks/useCanonicalResidenceAddress.ts
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — orquestra a jornada PF/residência canônica:
// preview canônico (país explícito) → snapshot de confirmação → comando actor-scoped (writer C).
//
// A confirmação está VINCULADA a um snapshot do preview: mudar country/CEP/cidade/bairro invalida
// a confirmação e exige novo preview. idempotencyKey por INTENÇÃO de salvar (reusada em retry,
// renovada após sucesso). NUNCA chama /api/location/cep; NUNCA envia tenant/role/owner.

import { useCallback, useRef, useState } from 'react';
import type { PostalAddressPreview } from '@unificard/contracts';
import {
  previewResidenceAddress,
  setActorResidenceAddress,
  getActorResidenceAddress,
} from '../api/actorTerritorialAddress';

export type ResidenceFlowState =
  | 'idle'
  | 'resolving'
  | 'resolved_requires_confirmation'
  | 'city_missing'
  | 'unresolved'
  | 'saving'
  | 'saved'
  | 'authority_denied'
  | 'concurrent_change'
  | 'idempotency_conflict'
  | 'mismatch'
  | 'error';

interface ConfirmationSnapshot {
  countryCode: string;
  postalCodeNormalized: string;
  cityId: string;
  neighborhoodId: string | null;
  neighborhoodStatus: PostalAddressPreview['neighborhood']['status'];
  street: string | null;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export function useCanonicalResidenceAddress(actorId: string | null) {
  const [flow, setFlow] = useState<ResidenceFlowState>('idle');
  const [preview, setPreview] = useState<PostalAddressPreview | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const snapshotRef = useRef<ConfirmationSnapshot | null>(null);
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());

  /** País SEMPRE explícito. Reset da confirmação a cada nova resolução. */
  const runPreview = useCallback(async (countryCode: string, cep: string) => {
    setConfirmed(false);
    snapshotRef.current = null;
    setErrorCode(null);
    setFlow('resolving');
    try {
      const r = await previewResidenceAddress(countryCode, cep);
      if (!r.ok) {
        setPreview(null);
        setFlow(r.code === 'canonical_city_missing' ? 'city_missing' : 'unresolved');
        return;
      }
      setPreview(r.preview);
      snapshotRef.current = {
        countryCode: countryCode.toUpperCase(),
        postalCodeNormalized: r.preview.postalCode,
        cityId: r.preview.city.id,
        neighborhoodId: r.preview.neighborhood.id,
        neighborhoodStatus: r.preview.neighborhood.status,
        street: r.preview.street,
      };
      setFlow('resolved_requires_confirmation');
    } catch {
      setPreview(null);
      setFlow('error');
    }
  }, []);

  /** Confirmação humana explícita — só válida sobre o snapshot atual. */
  const confirm = useCallback(() => {
    if (!snapshotRef.current) return;
    setConfirmed(true);
  }, []);

  /** Qualquer mudança territorial invalida a confirmação (força novo preview). */
  const invalidateConfirmation = useCallback(() => {
    setConfirmed(false);
    idempotencyKeyRef.current = newIdempotencyKey();
  }, []);

  /** Envia o comando actor-scoped. Exige confirmação vinculada ao snapshot. */
  const save = useCallback(
    async (fields: { street: string; number: string; complement?: string | null }) => {
      if (!actorId) { setFlow('error'); setErrorCode('actor_missing'); return; }
      const snap = snapshotRef.current;
      if (!snap || !confirmed) { setFlow('resolved_requires_confirmation'); return; }
      if (!fields.number.trim()) { setFlow('error'); setErrorCode('invalid_address_payload'); return; }
      setFlow('saving');
      setErrorCode(null);
      const r = await setActorResidenceAddress(actorId, {
        purpose: 'ACTOR_RESIDENCE',
        countryCode: snap.countryCode,
        postalCode: snap.postalCodeNormalized,
        street: fields.street,
        number: fields.number,
        complement: fields.complement ?? null,
        confirmedCityId: snap.cityId,
        confirmedNeighborhoodId: snap.neighborhoodStatus === 'resolved' ? snap.neighborhoodId : null,
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (r.ok) {
        setFlow('saved');
        idempotencyKeyRef.current = newIdempotencyKey(); // nova intenção após sucesso
        return;
      }
      setErrorCode(r.code);
      if (r.code === 'authority_denied') setFlow('authority_denied');
      else if (r.code === 'actor_territorial_in_progress') setFlow('concurrent_change');
      else if (r.code === 'idempotency_payload_mismatch') setFlow('idempotency_conflict');
      else if (r.code === 'territorial_confirmation_mismatch') setFlow('mismatch');
      else if (r.code === 'canonical_city_missing') setFlow('city_missing');
      else setFlow('error');
    },
    [actorId, confirmed],
  );

  const loadCurrent = useCallback(async () => {
    if (!actorId) return null;
    return getActorResidenceAddress(actorId);
  }, [actorId]);

  return { flow, preview, errorCode, confirmed, runPreview, confirm, invalidateConfirmation, save, loadCurrent };
}
