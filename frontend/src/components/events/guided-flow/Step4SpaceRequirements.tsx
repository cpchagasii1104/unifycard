// src/components/events/guided-flow/Step4SpaceRequirements.tsx
// ETAPA 4 — Onde (LOCAL) · Fase A orquestração (F-EVENT-ORCHESTRATION-TEMPLATES, GO Clayton 2026-07-08).
// Substitui o legado Casa/Salão/Buffet + Pequena/Média/Grande (misturava imóvel/espaço/fornecedor + escala
// vaga). Agora: STATUS DO LOCAL (location_mode governado) → região via Location Core (cityId SSOT, nunca
// texto). Capacidade fica no passo de custo (min/max). 'route' aparece DISABLED no MVP. Observação = texto
// livre SÓ como nota (nunca matching semântico). NÃO cria fornecedores/necessidades aqui (Fase B/C).

import { useState } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import { resolveCep } from '../../../api/location';
import './Step4SpaceRequirements.css';

interface Step4SpaceRequirementsProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
}

const MODES: Array<{ key: GuidedFlowData['locationMode']; label: string }> = [
  { key: 'fixed_place', label: 'Já tenho o local' },
  { key: 'to_be_defined', label: 'Ainda preciso de local' },
  { key: 'online', label: 'Online' },
  { key: 'hybrid', label: 'Híbrido' },
];

export default function Step4SpaceRequirements({ data, onUpdate, onComplete }: Step4SpaceRequirementsProps) {
  const [cep, setCep] = useState(data.venuePostalCode ?? '');
  const [resolving, setResolving] = useState(false);
  const mode = data.locationMode;
  const isVenue = mode === 'fixed_place' || mode === 'hybrid';
  const isRegion = mode === 'to_be_defined';

  const onCepChange = async (raw: string) => {
    setCep(raw);
    onUpdate({ venuePostalCode: raw });
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 8) {
      setResolving(true);
      try {
        const r = await resolveCep(digits);
        if (r?.resolved && r.cityId) {
          onUpdate({
            venueCityId: r.cityId,
            venueCityLabel: `${r.cityName}${r.stateUf ? ' / ' + r.stateUf : ''}`,
            venueNeighborhoodDisplay: r.neighborhoodDisplay ?? null,
          });
        }
      } finally { setResolving(false); }
    }
  };

  return (
    <div className="step4-space-requirements">
      <div className="step-header">
        <h2>Onde vai acontecer?</h2>
        <p className="step-hint">O local define a região — é dela que virão espaços e fornecedores depois.</p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Você já tem o local?</label>
          <div className="option-grid">
            {MODES.map((m) => (
              <button key={m.key} type="button"
                className={`option-button ${mode === m.key ? 'selected' : ''}`}
                onClick={() => onUpdate({ locationMode: m.key })}>
                {m.label}
              </button>
            ))}
            <button type="button" className="option-button" disabled title="Rota/múltiplos pontos ainda não disponível no MVP.">
              Rota / múltiplos pontos
            </button>
          </div>
        </div>

        {(isVenue || isRegion) && (
          <div className="form-group">
            <label className="form-label">{isRegion ? 'Em qual região?' : 'Onde será?'} (cidade via CEP)</label>
            <input type="text" inputMode="numeric" maxLength={9} className="form-textarea"
              placeholder="CEP (ex.: 80010-000)" value={cep} onChange={(e) => onCepChange(e.target.value)} />
            {resolving && <p className="step-hint">Resolvendo cidade…</p>}
            {data.venueCityId && (
              <p className="step-hint">📍 {data.venueCityLabel}{data.venueNeighborhoodDisplay ? ` · ${data.venueNeighborhoodDisplay}` : ''}</p>
            )}
            <p className="step-hint">A cidade vem do Location Core (verdade territorial) — nunca texto livre.</p>
          </div>
        )}

        {isRegion && (
          <div className="form-group">
            <label className="form-label">Raio de busca (km, opcional)</label>
            <input type="number" min={1} className="form-textarea" placeholder="Ex.: 10"
              value={data.desiredRadiusKm} onChange={(e) => onUpdate({ desiredRadiusKm: e.target.value })} />
          </div>
        )}

        {mode === 'online' && <p className="step-hint">Evento online — sem endereço físico. O link/plataforma entra na divulgação.</p>}

        {mode && (
          <div className="form-group">
            <label className="form-label">Observações (opcional)</label>
            <textarea className="form-textarea" rows={3} placeholder="Ex.: preciso de acessibilidade e estacionamento…"
              value={data.locationObservations} onChange={(e) => onUpdate({ locationObservations: e.target.value })} />
            <p className="step-hint">É só uma nota — não conecta fornecedores nem vira regra.</p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="step-button step-button-primary" onClick={onComplete}>Continuar</button>
      </div>
    </div>
  );
}
