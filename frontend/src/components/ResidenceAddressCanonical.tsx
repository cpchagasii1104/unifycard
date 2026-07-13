// src/components/ResidenceAddressCanonical.tsx
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — card canônico de residência PF.
//
// País EXPLÍCITO; preview canônico (resolver B via /locations/cep, nunca /api/location/cep);
// city/state canônicos read-only; número obrigatório; bairro resolved/candidate/pending; confirmação
// vinculada ao snapshot; idempotencyKey por intenção; leitura do vigente pelo read-model actor-scoped.
// NUNCA envia tenant/role/owner.

import { useEffect, useState } from 'react';
import { useCanonicalResidenceAddress } from '../hooks/useCanonicalResidenceAddress';
import type { TerritorialAddressCurrent } from '@unificard/contracts';

interface Props {
  actorId: string | null;
}

const DEFAULT_COUNTRY = 'BR';

export default function ResidenceAddressCanonical({ actorId }: Props) {
  const { flow, preview, errorCode, confirmed, runPreview, confirm, invalidateConfirmation, save, loadCurrent } =
    useCanonicalResidenceAddress(actorId);
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [cep, setCep] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [street, setStreet] = useState('');
  const [current, setCurrent] = useState<TerritorialAddressCurrent | null>(null);

  useEffect(() => {
    let alive = true;
    loadCurrent().then((c) => { if (alive) setCurrent(c); });
    return () => { alive = false; };
  }, [loadCurrent, flow === 'saved']);

  // street editável espelha o preview (mas não altera identidade city/state).
  useEffect(() => {
    if (preview && preview.street != null) setStreet(preview.street);
  }, [preview]);

  const onCepChange = (v: string) => {
    setCep(v);
    invalidateConfirmation();
  };
  const onCountryChange = (v: string) => {
    setCountryCode(v.toUpperCase());
    invalidateConfirmation();
  };

  const canPreview = cep.replace(/\D/g, '').length === 8 && !!countryCode;
  const nb = preview?.neighborhood;

  return (
    <div className="profile-form residence-address-canonical" style={{ marginTop: '1rem' }}>
      <h3>Endereço de residência (canônico)</h3>
      {actorId ? (
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Actor: {actorId}</p>
      ) : (
        <p style={{ color: 'crimson' }}>Selecione um Actor para cadastrar a residência.</p>
      )}

      {current?.state === 'active' && (
        <div className="residence-current" style={{ marginBottom: '1rem' }}>
          <strong>Residência vigente:</strong>{' '}
          {current.city?.displayName} / {current.state_?.code}
          {current.neighborhood ? ` — ${current.neighborhood.displayName}` : ''}
          {current.source === 'legacy_profile_fallback' && (
            <em style={{ marginLeft: 8, opacity: 0.7 }}>(compatibilidade legada)</em>
          )}
        </div>
      )}

      <label>
        País
        <select value={countryCode} onChange={(e) => onCountryChange(e.target.value)}>
          <option value="BR">Brasil (BR)</option>
        </select>
      </label>

      <label>
        CEP
        <input value={cep} onChange={(e) => onCepChange(e.target.value)} placeholder="00000-000" />
      </label>

      <button type="button" disabled={!canPreview || flow === 'resolving'} onClick={() => runPreview(countryCode, cep)}>
        {flow === 'resolving' ? 'Buscando…' : 'Buscar CEP'}
      </button>

      {flow === 'city_missing' && (
        <p style={{ color: 'darkorange' }}>
          Localidade ainda não disponível no catálogo canônico. Verifique o CEP/país.
        </p>
      )}
      {flow === 'unresolved' && <p style={{ color: 'darkorange' }}>CEP não resolvido. Verifique os dados.</p>}

      {preview && (flow === 'resolved_requires_confirmation' || confirmed || flow === 'saving') && (
        <div className="residence-preview">
          <div>Estado: <strong>{preview.state.displayName}</strong> (read-only)</div>
          <div>Cidade: <strong>{preview.city.displayName}</strong> (read-only)</div>
          <label>
            Logradouro
            <input value={street} onChange={(e) => setStreet(e.target.value)} />
          </label>
          <label>
            Número *
            <input value={number} onChange={(e) => setNumber(e.target.value)} required />
          </label>
          <label>
            Complemento
            <input value={complement} onChange={(e) => setComplement(e.target.value)} />
          </label>
          <div className="residence-neighborhood">
            {nb?.status === 'resolved' && <span>Bairro: <strong>{nb.displayName}</strong></span>}
            {nb?.status === 'candidate_requires_confirmation' && (
              <span>Bairro sugerido (ainda não confirmado pelo sistema): {nb.displayName}</span>
            )}
            {nb?.status === 'pending' && <span>Bairro pendente: {nb.displayName ?? '—'}</span>}
            {nb?.status === 'not_applicable' && <span>Sem bairro</span>}
          </div>

          {!confirmed ? (
            <button type="button" onClick={confirm}>Confirmar sugestão</button>
          ) : (
            <button type="button" disabled={flow === 'saving' || !number.trim()} onClick={() => save({ street, number, complement })}>
              {flow === 'saving' ? 'Salvando…' : 'Salvar residência'}
            </button>
          )}
        </div>
      )}

      {flow === 'saved' && <p style={{ color: 'green' }}>Residência salva.</p>}
      {flow === 'authority_denied' && <p style={{ color: 'crimson' }}>Sem autoridade para representar este Actor.</p>}
      {flow === 'concurrent_change' && <p style={{ color: 'darkorange' }}>Operação concorrente em andamento. Tente novamente.</p>}
      {flow === 'idempotency_conflict' && <p style={{ color: 'darkorange' }}>Conflito de idempotência (payload divergente).</p>}
      {flow === 'mismatch' && <p style={{ color: 'crimson' }}>A confirmação divergiu da re-resolução. Refaça a busca.</p>}
      {flow === 'error' && <p style={{ color: 'crimson' }}>Erro: {errorCode ?? 'inesperado'}.</p>}
    </div>
  );
}
