// Seção de LOCALIZAÇÃO transversal a toda locação (Clayton 2026-07-08): veículo/equip/imóvel/espaço.
// CEP é autocomplete/entrada auxiliar; a VERDADE é o Location Core (cityId governado). O front nunca
// grava city TEXT — o combobox de cidade é o SSOT; o CEP só preenche. Rótulos mudam por tipo de recurso.
// Privacidade: o aviso é fixo; quem decide expor rua/número é o BACKEND (GET /:id/address).
import { useState } from 'react';
import GovernedCombobox from '../common/GovernedCombobox';
import { searchCities, resolveCep, type CitySearchResult } from '../../api/location';
import './RentalAddressSection.css';

export interface ResourceLocationValue {
  city: CitySearchResult | null;        // cidade GOVERNADA (SSOT) — a verdade territorial
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhoodId: string | null;        // bairro canônico quando resolvido
  neighborhoodDisplay: string;          // bairro só-exibição
}

export const EMPTY_LOCATION: ResourceLocationValue = {
  city: null, postalCode: '', street: '', number: '', complement: '', neighborhoodId: null, neighborhoodDisplay: '',
};

const TITLE: Record<string, string> = {
  vehicle: 'Local de retirada/devolução',
  equipment: 'Local de retirada/entrega',
  property: 'Localização do imóvel',
  space: 'Localização do espaço',
};

export default function RentalAddressSection({
  resourceType, value, onChange,
}: {
  resourceType: 'vehicle' | 'equipment' | 'property' | 'space';
  value: ResourceLocationValue;
  onChange: (v: ResourceLocationValue) => void;
}) {
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const set = (patch: Partial<ResourceLocationValue>) => onChange({ ...value, ...patch });

  const handleCepResolve = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepBusy(true); setCepMsg(null);
    try {
      const r = await resolveCep(digits);
      if (r?.resolved && r.cityId) {
        set({
          city: { id: r.cityId, name: r.cityName ?? '', stateUf: r.stateUf },
          street: r.street ?? value.street,
          neighborhoodId: r.neighborhoodId ?? null,
          neighborhoodDisplay: r.neighborhoodDisplay ?? '',
          postalCode: r.postalCode ?? digits,
        });
        setCepMsg(`Endereço preenchido: ${r.cityName ?? ''}${r.stateUf ? `/${r.stateUf}` : ''}. Confira e complete o número.`);
      } else {
        setCepMsg('Não foi possível resolver o CEP — informe a cidade manualmente abaixo.');
      }
    } catch {
      setCepMsg('Erro ao resolver o CEP — informe a cidade manualmente.');
    } finally { setCepBusy(false); }
  };

  // Endereço completo (rua/número/complemento) para TODOS os tipos — Clayton: CEP transversal, endereço
  // completo salvo quando informado. A diferença por tipo é só rótulo + obrigatoriedade (número* no imóvel),
  // nunca o SSOT. Veículo/equip = opcional; imóvel = número obrigatório.
  const showStreet = true;

  return (
    <div className="ras">
      <div className="ras-title">📍 {TITLE[resourceType] ?? 'Localização'}</div>
      <div className="ras-row">
        <label className="ras-field">CEP
          <input type="text" inputMode="numeric" placeholder="Ex.: 80010-000" maxLength={9}
            value={value.postalCode}
            onChange={(e) => { set({ postalCode: e.target.value }); if (e.target.value.replace(/\D/g, '').length === 8) handleCepResolve(e.target.value); }} />
        </label>
        <div className="ras-field ras-field--city">Cidade *
          <GovernedCombobox<CitySearchResult>
            value={value.city} onChange={(c) => set({ city: c })}
            loadOptions={(q) => searchCities(q)} getOptionKey={(c) => c.id}
            getOptionLabel={(c) => (c.stateUf ? `${c.name} · ${c.stateUf}` : c.name)}
            placeholder="Cidade (confirme ou ajuste)" emptyMessage="Nenhuma cidade" />
        </div>
      </div>
      {cepBusy && <p className="ras-hint">Resolvendo CEP…</p>}
      {cepMsg && <p className="ras-hint">{cepMsg}</p>}

      {showStreet && (
        <div className="ras-row">
          <label className="ras-field ras-field--street">Rua
            <input type="text" placeholder="Rua/Avenida" value={value.street} onChange={(e) => set({ street: e.target.value })} />
          </label>
          <label className="ras-field ras-field--num">Número{resourceType === 'property' ? ' *' : ''}
            <input type="text" placeholder="123" value={value.number} onChange={(e) => set({ number: e.target.value })} />
          </label>
          <label className="ras-field">Complemento
            <input type="text" placeholder="Apto/Bloco (opcional)" value={value.complement} onChange={(e) => set({ complement: e.target.value })} />
          </label>
        </div>
      )}
      {showStreet && value.neighborhoodDisplay && <p className="ras-hint">Bairro: {value.neighborhoodDisplay}</p>}

      <p className="ras-privacy">🔒 O endereço completo só é mostrado ao locatário após a confirmação da locação. Publicamente aparece apenas cidade/bairro.</p>
    </div>
  );
}
