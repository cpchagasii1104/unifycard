// src/pages/RentalResourceListPage.tsx
// /locacoes por MODO OPERANTE (ordem Clayton 2026-07-07 — freio "sem discovery" da SLICE-B revogado):
//  · CONSUMIR → descoberta ("o que você quer alugar?"): tipos como filtro + recursos ATIVOS de terceiros.
//  · OPERAR  → gestão do dono: cadastro COMPLETO (catálogo + tipo + cobrança REGISTRO/0151-A)
//              + disponibilidade pela AGENDA UNIVERSAL (owner_type='rentable_resource' — SSOT temporal,
//              anti-sobreposição no banco; NUNCA calendário paralelo).
// A verdade mora no backend: esta tela só projeta (vocabulários e conflitos são do motor).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { useOperatingMode } from '../hooks/useOperatingMode';
import { showToast } from '../components/common/Toast';
import PublishProfileIntentPrompt from '../components/PublishProfileIntentPrompt';
import {
  createRentableResource,
  listMyRentableResources,
  listActiveRentableResources,
  listRentalConceptsByType,
  listEquipmentUseAreas,
  getRentalOfferDetail,
  updateRentalOffer,
  PRICING_UNIT_PT,
  RENTAL_PRICING_UNITS,
  type RentableResource,
  type RentableResourceType,
  type RentalPricingUnit,
  type RentalConceptOption,
  type EquipmentUseArea,
} from '../api/rentals';
import { createAvailability } from '../api/availability';
import { useAudienceOptions } from '../hooks/useAudienceOptions';
import AudiencePicker from '../components/composer/AudiencePicker';
import { resolveAudiencePayload } from '../components/composer/audience-payload';
import VehicleFields, { buildVehicleResourceName, type VehicleSelection } from '../components/composer/VehicleFields';
import GovernedCombobox from '../components/common/GovernedCombobox';
import { searchCities, type CitySearchResult } from '../api/location';
import PageModuleShell from '../components/layout/PageModuleShell';
import RightContextRail from '../components/layout/RightContextRail';
import './RentalResourceListPage.css';

// Tipo SEM N0 na ontologia congelada ainda (RFC_N0_IMOVEIS_E_PROPRIEDADES.md aguarda Clayton) —
// projeta o estado real (backend devolve [] pra estes); frontend NÃO inventa taxonomia.
// N0 bens-imoveis RATIFICADO por Clayton 2026-07-07 (RFC_N0_IMOVEIS_E_PROPRIEDADES.md v2) — nada
// mais pendente de RFC hoje. Mantido o array (vazio) caso um resourceType futuro precise do mesmo freio.
const TYPES_PENDING_RFC: RentableResourceType[] = [];

const RESOURCE_TYPE_LABEL: Record<RentableResourceType, string> = {
  equipment: 'Equipamento',
  vehicle: 'Veículo',
  property: 'Imóvel',
  space: 'Espaço',
};

const RESOURCE_TYPE_ICON: Record<RentableResourceType, string> = {
  equipment: '🔧',
  vehicle: '🚗',
  property: '🏠',
  space: '🏟️',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  retired: 'Aposentado',
};

const formatPrice = (r: RentableResource) =>
  r.priceCents != null && r.pricingUnit
    ? `R$ ${(r.priceCents / 100).toFixed(2).replace('.', ',')} · ${PRICING_UNIT_PT[r.pricingUnit]}`
    : 'Preço a combinar';

export default function RentalResourceListPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const { mode } = useOperatingMode();

  const [resources, setResources] = useState<RentableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RentableResourceType | 'all'>('all');

  // formulário de criação (operar)
  const [label, setLabel] = useState('');
  const [resourceType, setResourceType] = useState<RentableResourceType>('equipment');
  const [description, setDescription] = useState('');
  // Pergunta 1 "Para quem é isso?" — FONTE ÚNICA transversal /audience-options (deriva de
  // PAIR_ALLOWED_LABELS por actor). Zero lista local. Backend faz o enforcement na descoberta.
  const { options: audienceOptions } = useAudienceOptions();
  const [audienceKeys, setAudienceKeys] = useState<string[]>(['public']);
  // Fase 1 — faixas de preço: unidade → valor em R$ (string da UI; convertido pra cents no submit).
  const [tierReais, setTierReais] = useState<Partial<Record<RentalPricingUnit, string>>>({});
  // Fase 3 — quantidade (só equipment usa; default 1).
  const [quantity, setQuantity] = useState(1);
  const [conceptOptions, setConceptOptions] = useState<RentalConceptOption[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<RentalConceptOption | null>(null);
  // Área de uso (faceta governada de equipamento) — vem do backend, filtra a Categoria. Só equipment.
  const [useAreas, setUseAreas] = useState<EquipmentUseArea[]>([]);
  const [selectedUseArea, setSelectedUseArea] = useState<EquipmentUseArea | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const publishProfileRef = useRef<() => Promise<void>>(async () => {});

  // atributos de VEÍCULO (LAYER 5 — GOVERNADOS via catálogo transversal). Agora em cascata governada
  // (Categoria→Marca→Modelo→Ano) pelo <VehicleFields>: zero input livre, ano via endpoint.
  const [vehicleSel, setVehicleSel] = useState<VehicleSelection>({ concept: null, make: null, model: null, year: null, version: null });
  // Nome do recurso PROJETADO da identidade do veículo (read-only). Não é digitado nem armazenado
  // como verdade — os IDs governados (metadata) é que valem; este é só a etiqueta de exibição.
  const vehicleName = buildVehicleResourceName(vehicleSel);
  // Localização governada (F-RENTABLE-RESOURCE-LOCATION-MVP): cidade da SSOT `cities`, resolvida no
  // backend. O recurso fica na cidade do dono (retirada=devolução). Nunca texto livre.
  const [selectedCity, setSelectedCity] = useState<CitySearchResult | null>(null);

  // atributos de IMÓVEL (LAYER 5 — Facets, régua ratificada: "descreve COMO É", não "identifica O
  // QUE É" — não viram CONCEPT nem catálogo governado, ficam no metadata do recurso)
  const [propArea, setPropArea] = useState('');
  const [propBedrooms, setPropBedrooms] = useState('');
  const [propBathrooms, setPropBathrooms] = useState('');
  const [propFurnished, setPropFurnished] = useState(false);

  // edição da OFERTA do próprio anúncio (o dono edita preço/quantidade/cidade/descrição)
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editTierReais, setEditTierReais] = useState<Partial<Record<RentalPricingUnit, string>>>({});
  const [editQuantity, setEditQuantity] = useState(1);
  const [editCity, setEditCity] = useState<CitySearchResult | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // disponibilidade inline por recurso (operar) — janela vai pra AGENDA UNIVERSAL
  const [availFor, setAvailFor] = useState<string | null>(null);
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');
  const [availTimeStart, setAvailTimeStart] = useState('08:00');
  const [availTimeEnd, setAvailTimeEnd] = useState('18:00');
  const [availBusy, setAvailBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'operar') {
        if (!activeActor) { setResources([]); return; }
        setResources(await listMyRentableResources(activeActor.actor_id));
      } else {
        const all = await listActiveRentableResources();
        // descoberta = recursos de TERCEIROS (os meus eu gerencio no operar)
        setResources(all.filter((r) => r.ownerActorId !== activeActor?.actor_id));
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar recursos');
    } finally {
      setLoading(false);
    }
  }, [activeActor, mode]);

  useEffect(() => { load(); }, [load]);

  // fix Clayton 2026-07-07: categoria vem do CATÁLOGO FILTRADO PELO TIPO (nunca do catálogo inteiro)
  useEffect(() => {
    setSelectedConcept(null);
    setConceptOptions([]);
    setSelectedUseArea(null);
    setVehicleSel({ concept: null, make: null, model: null, year: null, version: null });
    setPropArea(''); setPropBedrooms(''); setPropBathrooms(''); setPropFurnished(false);
  }, [resourceType]);

  // Áreas de uso (faceta governada) — carregadas uma vez; usadas só quando Tipo = Equipamento.
  useEffect(() => {
    listEquipmentUseAreas().then(setUseAreas).catch(() => setUseAreas([]));
  }, []);

  // conceptOptions = todas as categorias do tipo (usado pelo VehicleFields, que filtra local). O
  // GovernedCombobox de categoria (não-veículo) faz o próprio fetch reabrível — não depende disto.
  useEffect(() => {
    if (TYPES_PENDING_RFC.includes(resourceType)) { setConceptOptions([]); return; }
    const t = setTimeout(() => {
      listRentalConceptsByType(resourceType, '').then(setConceptOptions).catch(() => setConceptOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [resourceType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Veículo usa a cascata governada (vehicleSel.concept); demais tipos usam a categoria geral.
    const isVehicle = resourceType === 'vehicle';
    const effectiveConcept = isVehicle ? vehicleSel.concept : selectedConcept;
    if (!effectiveConcept?.concept_id) { showToast('Escolha uma categoria existente do catálogo.', 'error'); return; }
    if (isVehicle && !vehicleSel.make) { showToast('Escolha a marca do veículo.', 'error'); return; }
    if (isVehicle && !vehicleSel.model) { showToast('Escolha o modelo do veículo.', 'error'); return; }
    // Veículo: nome projetado da identidade (não digitado). Outros: nome digitado obrigatório.
    const effectiveName = isVehicle ? vehicleName : label.trim();
    if (!effectiveName) { showToast(isVehicle ? 'Complete marca, modelo e ano do veículo.' : 'Informe um nome para o recurso.', 'error'); return; }
    setSubmitting(true);
    try {
      // Faixas: R$ (UI) → cents (verdade). Só as preenchidas com valor > 0 viram faixa.
      const pricingTiers = RENTAL_PRICING_UNITS
        .map((u) => ({ unit: u, priceCents: Math.round((parseFloat((tierReais[u] ?? '').replace(',', '.')) || 0) * 100) }))
        .filter((t) => t.priceCents > 0);
      const metadata: Record<string, unknown> = {};
      if (isVehicle) {
        // GOVERNADO: sempre IDs do catálogo (nunca texto digitado); nome só como projeção de exibição
        if (vehicleSel.make) { metadata.vehicleMakeId = vehicleSel.make.id; metadata.vehicleMakeName = vehicleSel.make.name; }
        if (vehicleSel.model) { metadata.vehicleModelId = vehicleSel.model.id; metadata.vehicleModelName = vehicleSel.model.name; }
        // Versão = referência à variante do catálogo. A ficha técnica NÃO é copiada — projeta-se do
        // catálogo por (modelo, ano, versão). Guarda só o ponteiro (anti-verdade-paralela).
        if (vehicleSel.version) metadata.vehicleVersion = vehicleSel.version.version;
      }
      if (resourceType === 'property' || resourceType === 'space') {
        // Facets puras (descrevem, não identificam) — validadas como número/booleano, nunca texto livre
        if (propArea.trim()) metadata.areaM2 = Number(propArea);
        if (propBedrooms.trim()) metadata.bedrooms = parseInt(propBedrooms, 10);
        if (propBathrooms.trim()) metadata.bathrooms = parseInt(propBathrooms, 10);
        metadata.furnished = propFurnished;
      }
      const aud = resolveAudiencePayload(audienceOptions, audienceKeys);
      await createRentableResource({
        conceptId: effectiveConcept.concept_id,
        resourceType,
        label: effectiveName,
        description: description.trim() || null,
        resourceYear: isVehicle ? vehicleSel.year : null, // ano governado (dropdown), nunca texto livre
        metadata,
        visibility: aud.visibility,
        audienceRelationshipTypes: aud.audienceRelationshipTypes,
        pricingTiers, // faixas em cents (verdade); vazio se nada preenchido
        quantity: resourceType === 'equipment' ? quantity : 1, // único vs fungível (backend revalida)
        cityId: selectedCity?.id ?? null, // localização governada (SSOT cities), nunca texto livre
      });
      await publishProfileRef.current();
      showToast('Recurso cadastrado. Agora adicione a disponibilidade. 🗓️', 'success');
      setShowForm(false);
      setLabel(''); setDescription(''); setTierReais({}); setQuantity(1);
      setSelectedConcept(null); setSelectedCity(null);
      setVehicleSel({ concept: null, make: null, model: null, year: null, version: null });
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cadastrar recurso', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // abre o form de edição preenchido com a oferta ATUAL (faixas/cidade vêm do backend)
  const openEdit = async (resourceId: string) => {
    if (editFor === resourceId) { setEditFor(null); return; }
    setAvailFor(null);
    try {
      const detail = await getRentalOfferDetail(resourceId);
      const reais: Partial<Record<RentalPricingUnit, string>> = {};
      detail.pricingTiers.forEach((t) => { reais[t.unit] = (t.priceCents / 100).toFixed(2).replace('.', ','); });
      setEditTierReais(reais);
      setEditQuantity(detail.resource.quantity ?? 1);
      setEditCity(detail.city ? { id: detail.city.cityId, name: detail.city.name, stateUf: detail.city.uf } : null);
      setEditDescription(detail.resource.description ?? '');
      setEditFor(resourceId);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar o anúncio para edição', 'error');
    }
  };

  const handleSaveEdit = async (resourceId: string) => {
    setEditBusy(true);
    try {
      const pricingTiers = RENTAL_PRICING_UNITS
        .map((u) => ({ unit: u, priceCents: Math.round((parseFloat((editTierReais[u] ?? '').replace(',', '.')) || 0) * 100) }))
        .filter((t) => t.priceCents > 0);
      await updateRentalOffer(resourceId, {
        description: editDescription.trim() || null,
        pricingTiers,
        quantity: editQuantity,
        cityId: editCity?.id ?? null,
      });
      showToast('Anúncio atualizado. ✅', 'success');
      setEditFor(null);
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar', 'error');
    } finally {
      setEditBusy(false);
    }
  };

  const handleAddAvailability = async (resourceId: string) => {
    if (!availStart) { showToast('Informe a data de início da janela.', 'error'); return; }
    setAvailBusy(true);
    try {
      await createAvailability({
        ownerType: 'rentable_resource',
        ownerId: resourceId,
        startDatetime: `${availStart}T${availTimeStart || '00:00'}:00`,
        endDatetime: `${availEnd || availStart}T${availTimeEnd || '23:59'}:00`,
      });
      showToast('Janela de disponibilidade registrada na Agenda. ✅', 'success');
      setAvailFor(null); setAvailStart(''); setAvailEnd('');
    } catch (err: any) {
      // conflito de sobreposição vem do BANCO (advisory lock + trigger) — a verdade é do motor
      showToast(err?.message || 'Erro ao registrar disponibilidade', 'error');
    } finally {
      setAvailBusy(false);
    }
  };

  if (!activeActor) {
    return <div className="rrl-page"><p>Selecione um actor para usar Locações.</p></div>;
  }

  const visible = typeFilter === 'all' ? resources : resources.filter((r) => r.resourceType === typeFilter);

  // ── MODO CONSUMIR: descoberta (análogo ao Fazer compras) ──
  if (mode === 'consumir') {
    return (
      <PageModuleShell
        title="🔑 Alugar algo"
        subtitle="Imóveis, veículos, equipamentos e espaços disponíveis na comunidade."
        rail={<RightContextRail module="rentals" />}
      >
        <div className="rrl-type-hub">
          <button type="button" className={`rrl-type-card ${typeFilter === 'all' ? 'selected' : ''}`} onClick={() => setTypeFilter('all')}>
            <span className="rrl-type-icon">🔎</span><strong>Tudo</strong>
          </button>
          {(Object.keys(RESOURCE_TYPE_LABEL) as RentableResourceType[]).map((t) => (
            <button key={t} type="button" className={`rrl-type-card ${typeFilter === t ? 'selected' : ''}`} onClick={() => setTypeFilter(t)}>
              <span className="rrl-type-icon">{RESOURCE_TYPE_ICON[t]}</span>
              <strong>{RESOURCE_TYPE_LABEL[t]}s</strong>
            </button>
          ))}
        </div>

        {loading && <p className="rrl-status">Carregando…</p>}
        {error && <p className="rrl-status rrl-error">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="rrl-status">Nenhum recurso disponível {typeFilter !== 'all' ? `em ${RESOURCE_TYPE_LABEL[typeFilter as RentableResourceType]}s` : ''} ainda — a comunidade está começando. Troque para OPERAR e seja o primeiro a anunciar. 🚀</p>
        )}

        <div className="rrl-grid">
          {visible.map((r) => (
            <button key={r.id} type="button" className="rrl-card" onClick={() => navigate(`/locacoes/${r.id}`)}>
              <span className="rrl-card-type">{RESOURCE_TYPE_ICON[r.resourceType]} {RESOURCE_TYPE_LABEL[r.resourceType]}</span>
              <span className="rrl-card-label">{r.label}</span>
              <span className="rrl-card-price">{formatPrice(r)}</span>
              {r.description && <span className="rrl-card-desc">{r.description.slice(0, 90)}</span>}
              <span className="rrl-card-cta">Ver disponibilidade →</span>
            </button>
          ))}
        </div>
      </PageModuleShell>
    );
  }

  // ── MODO OPERAR: gestão do dono ──
  return (
    <PageModuleShell
      title="Meus Recursos Alugáveis"
      subtitle="Equipamentos, veículos, imóveis e espaços que você disponibiliza para locação."
      actions={
        <button type="button" className="rrl-new-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Novo recurso'}
        </button>
      }
      rail={<RightContextRail module="rentals" />}
    >
      {showForm && (
        <form className="rrl-form" onSubmit={handleCreate}>
          {/* Pergunta 1 (matriz única de plateia): AudiencePicker multi-seleção, /audience-options. */}
          <AudiencePicker options={audienceOptions} selectedKeys={audienceKeys} onChange={setAudienceKeys} />

          {/* fix Clayton: o TIPO, aí sim a categoria relacionada (mesma lógica de grupos/demanda) */}
          <label className="rrl-field">
            2 · Tipo de recurso
            <select value={resourceType} onChange={(e) => setResourceType(e.target.value as RentableResourceType)}>
              {(Object.keys(RESOURCE_TYPE_LABEL) as RentableResourceType[]).map((t) => (
                <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          {TYPES_PENDING_RFC.includes(resourceType) ? (
            <p className="rrl-hint rrl-hint--blocked">
              🚧 {RESOURCE_TYPE_LABEL[resourceType]} ainda não tem categoria — a ontologia do sistema
              não define esse domínio ainda (aguardando decisão de arquitetura). Em breve.
            </p>
          ) : resourceType === 'vehicle' ? (
            /* Veículo: cascata GOVERNADA reabrível (Categoria→Marca→Modelo→Ano) — zero texto livre,
               ano via endpoint. O catálogo transversal que rides/venda/peças reutilizam depois. */
            <div className="rrl-field">
              <span>3 · Veículo</span>
              <VehicleFields value={vehicleSel} onChange={setVehicleSel} conceptOptions={conceptOptions} conceptLabel={(c) => c.label} />
            </div>
          ) : (
            /* Categoria GOVERNADA reabrível (mesmo componente do veículo): clicar abre a lista sem
               digitar; reabrível; estados honestos. Zero lista local, zero hardcode. Para EQUIPAMENTO,
               a Área de uso (faceta governada do backend) filtra a Categoria — RFC-*-USE-AREAS-MVP. */
            <>
              {resourceType === 'equipment' && (
                <div className="rrl-field">
                  <span>3 · Área de uso</span>
                  <GovernedCombobox<EquipmentUseArea>
                    value={selectedUseArea}
                    onChange={(a) => { setSelectedUseArea(a); setSelectedConcept(null); }}
                    loadOptions={async (q) => {
                      const all = useAreas;
                      return q.trim() ? all.filter((a) => a.label.toLowerCase().includes(q.trim().toLowerCase())) : all;
                    }}
                    getOptionKey={(a) => a.code}
                    getOptionLabel={(a) => `${a.label} (${a.concept_count})`}
                    placeholder="Todas as áreas"
                    emptyMessage="Nenhuma área disponível."
                  />
                </div>
              )}
              <div className="rrl-field">
                <span>{resourceType === 'equipment' ? '4' : '3'} · Categoria ({RESOURCE_TYPE_LABEL[resourceType].toLowerCase()})</span>
                <GovernedCombobox<RentalConceptOption>
                  value={selectedConcept}
                  onChange={setSelectedConcept}
                  loadOptions={(q) => listRentalConceptsByType(resourceType, q, resourceType === 'equipment' ? selectedUseArea?.code : null)}
                  getOptionKey={(c) => c.concept_id}
                  getOptionLabel={(c) => c.label}
                  placeholder={`Buscar em ${RESOURCE_TYPE_LABEL[resourceType].toLowerCase()}s…`}
                  emptyMessage="Nenhuma categoria disponível para este tipo."
                />
              </div>
            </>
          )}

          {/* Veículo: nome PROJETADO da identidade (read-only, não digitado). Outros tipos: livre.
              Personalizável por categoria — cada tipo compõe/entra seu nome como fizer sentido. */}
          {resourceType === 'vehicle' ? (
            <label className="rrl-field">
              Nome do recurso <span className="rrl-auto-tag">automático</span>
              <input type="text" value={vehicleName || 'Escolha marca, modelo e ano…'} readOnly
                className={vehicleName ? 'rrl-input--auto' : 'rrl-input--auto rrl-input--placeholder'} />
            </label>
          ) : (
            <label className="rrl-field">
              Nome do recurso
              <input type="text" placeholder="Ex.: Furadeira Bosch, Fusca 1978…" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
            </label>
          )}

          {/* Localização governada: cidade da SSOT (backend resolve; nunca texto livre). O recurso fica
              nesta cidade — retirada e devolução no mesmo local. Vitrine mostra só a cidade. */}
          <div className="rrl-field">
            Cidade (retirada e devolução)
            <GovernedCombobox<CitySearchResult>
              value={selectedCity}
              onChange={setSelectedCity}
              loadOptions={(q) => searchCities(q)}
              getOptionKey={(c) => c.id}
              getOptionLabel={(c) => c.stateUf ? `${c.name} · ${c.stateUf}` : c.name}
              placeholder="Buscar cidade…"
              emptyMessage="Nenhuma cidade encontrada"
            />
          </div>

          {/* Imóvel/Espaço: Facets puras (régua ratificada: "descreve COMO É", não "identifica O
              QUE É" — apartamento/casa/galpão já são o CONCEPT; metragem/quartos são atributo) */}
          {(resourceType === 'property' || resourceType === 'space') && (
            <div className="rrl-row">
              <label className="rrl-field">Área (m²)<input type="number" min={1} placeholder="Ex.: 65" value={propArea} onChange={(e) => setPropArea(e.target.value)} /></label>
              <label className="rrl-field">Quartos<input type="number" min={0} max={20} placeholder="Ex.: 2" value={propBedrooms} onChange={(e) => setPropBedrooms(e.target.value)} /></label>
              <label className="rrl-field">Banheiros<input type="number" min={0} max={20} placeholder="Ex.: 1" value={propBathrooms} onChange={(e) => setPropBathrooms(e.target.value)} /></label>
              <label className="rrl-field rrl-field--checkbox">
                <input type="checkbox" checked={propFurnished} onChange={(e) => setPropFurnished(e.target.checked)} /> Mobiliado
              </label>
            </div>
          )}

          {/* Fase 3 — Quantidade: só para EQUIPAMENTO (fungível). Veículo/imóvel/espaço são únicos (1). */}
          {resourceType === 'equipment' && (
            <label className="rrl-field">
              Quantidade disponível
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
              <span className="rrl-hint">Ex.: 100 cadeiras. Podem ser alugadas por pessoas diferentes ao mesmo tempo.</span>
            </label>
          )}

          {/* Fase 1 — Faixas de preço: o dono ativa as unidades que quiser e o valor de cada. Preço em
              R$ na UI; enviado em cents. É ANÚNCIO — pagamento não acontece pelo sistema. */}
          <div className="rrl-field">
            Preço anunciado por faixa <span className="rrl-hint" style={{ fontWeight: 400 }}>(preencha as que oferecer)</span>
            <div className="rrl-tiers">
              {RENTAL_PRICING_UNITS.map((u) => (
                <div key={u} className="rrl-tier">
                  <span className="rrl-tier-label">{PRICING_UNIT_PT[u]}</span>
                  <span className="rrl-tier-prefix">R$</span>
                  <input type="text" inputMode="decimal" placeholder="0,00"
                    value={tierReais[u] ?? ''}
                    onChange={(e) => setTierReais((prev) => ({ ...prev, [u]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <p className="rrl-hint">💡 O preço é o ANÚNCIO — o pagamento em si ainda não acontece pelo sistema.</p>

          <label className="rrl-field">
            Descrição (opcional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          </label>

          <PublishProfileIntentPrompt
            contextLabel="Seu recurso será achável para locação."
            onRegister={(fn) => { publishProfileRef.current = fn; }}
          />

          <button type="submit" className="rrl-submit-btn" disabled={submitting || TYPES_PENDING_RFC.includes(resourceType)}>
            {submitting ? 'Cadastrando…' : 'Cadastrar recurso'}
          </button>
        </form>
      )}

      {loading && <p className="rrl-status">Carregando…</p>}
      {error && <p className="rrl-status rrl-error">{error}</p>}
      {!loading && !error && resources.length === 0 && (
        <p className="rrl-status">Nenhum recurso cadastrado ainda.</p>
      )}

      <div className="rrl-grid">
        {resources.map((r) => (
          <div key={r.id} className="rrl-card rrl-card--own">
            <span className={`rrl-status-badge rrl-status-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            <span className="rrl-card-type">{RESOURCE_TYPE_ICON[r.resourceType]} {RESOURCE_TYPE_LABEL[r.resourceType]}</span>
            <span className="rrl-card-label">{r.label}</span>
            <span className="rrl-card-price">{formatPrice(r)}</span>
            <div className="rrl-card-actions">
              <button type="button" onClick={() => navigate(`/locacoes/${r.id}`)}>Detalhes</button>
              <button type="button" onClick={() => openEdit(r.id)}>
                {editFor === r.id ? 'Cancelar' : '✏️ Editar'}
              </button>
              <button type="button" onClick={() => setAvailFor(availFor === r.id ? null : r.id)}>
                {availFor === r.id ? 'Fechar' : '🗓️ Disponibilidade'}
              </button>
            </div>
            {editFor === r.id && (
              <div className="rrl-avail-form">
                {/* Edição da OFERTA (o dono edita o próprio anúncio). Identidade do item fica intacta. */}
                <div className="rrl-field">
                  Preço anunciado por faixa <span className="rrl-hint" style={{ fontWeight: 400 }}>(preencha as que oferecer)</span>
                  <div className="rrl-tiers">
                    {RENTAL_PRICING_UNITS.map((u) => (
                      <div key={u} className="rrl-tier">
                        <span className="rrl-tier-label">{PRICING_UNIT_PT[u]}</span>
                        <span className="rrl-tier-prefix">R$</span>
                        <input type="text" inputMode="decimal" placeholder="0,00"
                          value={editTierReais[u] ?? ''}
                          onChange={(e) => setEditTierReais((prev) => ({ ...prev, [u]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>
                {r.resourceType === 'equipment' && (
                  <label className="rrl-field">Quantidade disponível
                    <input type="number" min={1} value={editQuantity} onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                  </label>
                )}
                <div className="rrl-field">Cidade (retirada e devolução)
                  <GovernedCombobox<CitySearchResult>
                    value={editCity} onChange={setEditCity}
                    loadOptions={(q) => searchCities(q)} getOptionKey={(c) => c.id}
                    getOptionLabel={(c) => c.stateUf ? `${c.name} · ${c.stateUf}` : c.name}
                    placeholder="Buscar cidade…" emptyMessage="Nenhuma cidade encontrada" />
                </div>
                <label className="rrl-field">Descrição
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={2000} rows={2} />
                </label>
                <button type="button" className="rrl-submit-btn" disabled={editBusy} onClick={() => handleSaveEdit(r.id)}>
                  {editBusy ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            )}
            {availFor === r.id && (
              <div className="rrl-avail-form">
                <div className="rrl-row">
                  <label className="rrl-field">De<input type="date" value={availStart} onChange={(e) => setAvailStart(e.target.value)} /></label>
                  <label className="rrl-field">Até<input type="date" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} /></label>
                </div>
                <div className="rrl-row">
                  <label className="rrl-field">Das<input type="time" value={availTimeStart} onChange={(e) => setAvailTimeStart(e.target.value)} /></label>
                  <label className="rrl-field">Às<input type="time" value={availTimeEnd} onChange={(e) => setAvailTimeEnd(e.target.value)} /></label>
                </div>
                <button type="button" className="rrl-submit-btn" disabled={availBusy} onClick={() => handleAddAvailability(r.id)}>
                  {availBusy ? 'Registrando…' : 'Registrar janela na Agenda'}
                </button>
                <p className="rrl-hint">A Agenda universal recusa janelas sobrepostas — se o recurso já estiver comprometido no período, o sistema barra sozinho.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </PageModuleShell>
  );
}
