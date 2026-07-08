// frontend/src/components/composer/VehicleFields.tsx
// Campos GOVERNADOS de veículo em cascata (Clayton 2026-07-07): Categoria → Marca → Modelo → Ano.
// Compõe os endpoints do catálogo via <GovernedCombobox> genérico. Cascata: trocar o pai LIMPA os
// filhos automaticamente (usuário não briga com o formulário) + mensagem discreta. O front NÃO
// decide validade — só lista o que o backend devolve; o backend valida a combinação no submit.
import { useState } from 'react';
import GovernedCombobox from '../common/GovernedCombobox';
import {
  searchVehicleMakes, listVehicleModels, listVehicleModelYears,
  type VehicleMake, type VehicleModel,
} from '../../api/rentals';
import type { RentalConceptOption } from '../../api/rentals';
import './VehicleFields.css';

export interface VehicleSelection {
  concept: RentalConceptOption | null; // Categoria (carro/motocicleta/...) — do catálogo por tipo
  make: VehicleMake | null;
  model: VehicleModel | null;
  year: number | null;
}

export default function VehicleFields({
  value, onChange, conceptOptions, conceptLabel,
}: {
  value: VehicleSelection;
  onChange: (v: VehicleSelection) => void;
  /** Categorias de veículo já filtradas por tipo (vêm de /rentable-resources/concepts do pai). */
  conceptOptions: RentalConceptOption[];
  conceptLabel: (c: RentalConceptOption) => string;
}) {
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);
  const flash = (m: string) => { setClearedMsg(m); setTimeout(() => setClearedMsg((v) => (v === m ? null : v)), 3500); };

  // Trocar CATEGORIA limpa marca+modelo+ano.
  const setConcept = (concept: RentalConceptOption | null) => {
    if (value.make || value.model || value.year) flash('Marca, modelo e ano foram limpos porque dependem da categoria.');
    onChange({ concept, make: null, model: null, year: null });
  };
  // Trocar MARCA limpa modelo+ano.
  const setMake = (make: VehicleMake | null) => {
    if (value.model || value.year) flash('Modelo e ano foram limpos porque dependem da marca.');
    onChange({ ...value, make, model: null, year: null });
  };
  // Trocar MODELO limpa ano.
  const setModel = (model: VehicleModel | null) => {
    if (value.year) flash('O ano foi limpo porque depende do modelo.');
    onChange({ ...value, model, year: null });
  };
  const setYear = (year: number | null) => onChange({ ...value, year });

  return (
    <div className="vf">
      <div className="vf-row">
        <GovernedCombobox<RentalConceptOption>
          label="Categoria"
          value={value.concept}
          onChange={setConcept}
          loadOptions={async (q) => conceptOptions.filter((c) =>
            !q.trim() || conceptLabel(c).toLowerCase().includes(q.trim().toLowerCase()))}
          getOptionKey={(c) => c.concept_id}
          getOptionLabel={conceptLabel}
          placeholder="Ex.: carro, moto…"
          emptyMessage="Nenhuma categoria de veículo"
        />

        <GovernedCombobox<VehicleMake>
          label="Marca"
          value={value.make}
          onChange={setMake}
          disabledReason={value.concept ? null : 'Escolha a categoria primeiro'}
          loadOptions={(q) => value.concept ? searchVehicleMakes(q, value.concept.concept_id) : Promise.resolve([])}
          getOptionKey={(m) => m.id}
          getOptionLabel={(m) => m.name}
          placeholder="Buscar marca…"
          emptyMessage="Nenhuma marca para essa categoria"
        />

        <GovernedCombobox<VehicleModel>
          label="Modelo"
          value={value.model}
          onChange={setModel}
          disabledReason={value.make && value.concept ? null : 'Escolha marca + categoria primeiro'}
          loadOptions={(q) => value.make && value.concept
            ? listVehicleModels(value.make.id, value.concept.concept_id, q)
            : Promise.resolve([])}
          getOptionKey={(m) => m.id}
          getOptionLabel={(m) => m.name}
          placeholder="Buscar modelo…"
          emptyMessage="Nenhum modelo para essa marca + categoria"
        />

        <GovernedCombobox<number>
          label="Ano"
          value={value.year}
          onChange={setYear}
          disabledReason={value.model ? null : 'Escolha o modelo primeiro'}
          loadOptions={async () => value.model ? listVehicleModelYears(value.model.id) : []}
          getOptionKey={(y) => String(y)}
          getOptionLabel={(y) => String(y)}
          placeholder="Selecionar ano…"
          emptyMessage="Anos não disponíveis para este modelo"
        />
      </div>
      {clearedMsg && <p className="vf-cleared" role="status">{clearedMsg}</p>}
    </div>
  );
}
