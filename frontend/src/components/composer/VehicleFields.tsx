// frontend/src/components/composer/VehicleFields.tsx
// Campos GOVERNADOS de veículo em cascata (Clayton 2026-07-07): Categoria → Marca → Modelo → Ano.
// Compõe os endpoints do catálogo via <GovernedCombobox> genérico. Cascata: trocar o pai LIMPA os
// filhos automaticamente (usuário não briga com o formulário) + mensagem discreta. O front NÃO
// decide validade — só lista o que o backend devolve; o backend valida a combinação no submit.
import { useState } from 'react';
import GovernedCombobox from '../common/GovernedCombobox';
import {
  searchVehicleMakes, listVehicleModels, listVehicleModelYears, listVehicleVersions,
  type VehicleMake, type VehicleModel, type VehicleVersionSpec,
} from '../../api/rentals';
import type { RentalConceptOption } from '../../api/rentals';
import './VehicleFields.css';

export interface VehicleSelection {
  concept: RentalConceptOption | null; // Categoria (carro/motocicleta/...) — do catálogo por tipo
  make: VehicleMake | null;
  model: VehicleModel | null;
  year: number | null;
  version: VehicleVersionSpec | null;  // versão (trim) + ficha técnica AUTO-COMPLETADA do catálogo
}

/**
 * Nome de exibição do recurso PROJETADO da identidade do catálogo (Clayton 2026-07-08). Não é texto
 * livre nem cópia — é derivado de marca/modelo/ano/versão(+atributos-chave da ficha). Anti-verdade-
 * paralela: os IDs governados são a verdade (metadata); este nome é só a etiqueta de exibição.
 * Vazio até haver identidade suficiente (marca+modelo+ano).
 */
export function buildVehicleResourceName(sel: VehicleSelection): string {
  if (!sel.make || !sel.model || !sel.year) return '';
  const core = `${sel.make.name} ${sel.model.name} ${sel.year}`;
  if (!sel.version) return core;
  const v = sel.version;
  // versao_nome já é o descritor COMPLETO (motor/câmbio) — usa-o direto p/ não repetir; senão compõe.
  if (v.versao_nome && v.versao_nome.trim()) return `${core} · ${v.versao_nome.trim()}`;
  const tech = [v.version, v.cambio, v.combustivel, v.tracao].filter((x) => x && String(x).trim());
  return `${core} · ${tech.join(' · ')}`;
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

  // Cascata: trocar um pai limpa todos os filhos (incl. versão, que carrega a ficha).
  const setConcept = (concept: RentalConceptOption | null) => {
    if (value.make || value.model || value.year) flash('Marca, modelo, ano e versão foram limpos porque dependem da categoria.');
    onChange({ concept, make: null, model: null, year: null, version: null });
  };
  const setMake = (make: VehicleMake | null) => {
    if (value.model || value.year) flash('Modelo, ano e versão foram limpos porque dependem da marca.');
    onChange({ ...value, make, model: null, year: null, version: null });
  };
  const setModel = (model: VehicleModel | null) => {
    if (value.year) flash('Ano e versão foram limpos porque dependem do modelo.');
    onChange({ ...value, model, year: null, version: null });
  };
  const setYear = (year: number | null) => onChange({ ...value, year, version: null });
  const setVersion = (version: VehicleVersionSpec | null) => onChange({ ...value, version });

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

        <GovernedCombobox<VehicleVersionSpec>
          label="Versão"
          value={value.version}
          onChange={setVersion}
          disabledReason={value.model && value.year ? null : 'Escolha o ano primeiro'}
          loadOptions={async () => value.model && value.year ? listVehicleVersions(value.model.id, value.year) : []}
          // key = ID ESTÁVEL da variante (variant_id), nunca o texto visível — evita chave React duplicada
          // quando o mesmo `version` tem 2 variantes (ex.: Drive Manual × Drive CVT).
          getOptionKey={(v) => v.variant_id ?? v.version}
          // rótulo COMPLETO (versao_nome) — distingue "1.3 Flex Drive Manual" de "...CVT"; sem inventar texto.
          getOptionLabel={(v) => v.versao_nome ?? v.version}
          placeholder="Selecionar versão…"
          emptyMessage="Sem versões cadastradas para este ano"
        />
      </div>
      {clearedMsg && <p className="vf-cleared" role="status">{clearedMsg}</p>}

      {/* Ficha técnica AUTO-COMPLETADA (herdada do catálogo — read-only, o anunciante não digita).
          Prova o "cadastra uma vez": escolheu a versão, a ficha aparece pronta. */}
      {value.version && <VehicleSpecSheet spec={value.version} />}
    </div>
  );
}

// Painel read-only da ficha — projeta os campos preenchidos da variante escolhida. Não edita nada.
function VehicleSpecSheet({ spec }: { spec: VehicleVersionSpec }) {
  const fields: Array<[string, string | number | null | undefined, string?]> = [
    ['Motor', spec.motor], ['Cilindrada', spec.cilindrada_cc, 'cc'], ['Potência', spec.potencia_cv, 'cv'],
    ['Torque', spec.torque_kgfm, 'kgfm'], ['Combustível', spec.combustivel], ['Tração', spec.tracao],
    ['Câmbio', spec.cambio], ['Portas', spec.num_portas], ['Carga', spec.capacidade_carga_kg, 'kg'],
    ['Peso', spec.peso_kg, 'kg'], ['Comprimento', spec.comprimento_cm, 'cm'], ['Largura', spec.largura_cm, 'cm'],
    ['Altura', spec.altura_cm, 'cm'], ['Entre-eixos', spec.entre_eixos_cm, 'cm'], ['Pneus', spec.pneus],
    ['Freios diant.', spec.freios_diant], ['Freios tras.', spec.freios_tras],
    ['Susp. diant.', spec.suspensao_diant], ['Susp. tras.', spec.suspensao_tras], ['Direção', spec.direcao],
    ['Tanque', spec.tanque_litros, 'L'], ['Caçamba', spec.cacamba_litros, 'L'],
  ];
  const shown = fields.filter(([, v]) => v !== null && v !== undefined && v !== '');
  return (
    <div className="vf-spec">
      <div className="vf-spec-head">
        <span className="vf-spec-badge">Ficha técnica</span>
        <span className="vf-spec-note">preenchida pelo catálogo — você não precisa digitar</span>
      </div>
      <dl className="vf-spec-grid">
        {shown.map(([label, v, unit]) => (
          <div key={label} className="vf-spec-item">
            <dt>{label}</dt>
            <dd>{v}{unit ? ` ${unit}` : ''}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
