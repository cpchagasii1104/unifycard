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
  discoverRentals,
  type RentalDiscoverCard,
  PRICING_UNIT_PT,
  RENTAL_PRICING_UNITS,
  type RentableResource,
  type MyResource,
  getMyRentalBookings,
  cancelMyRentalBooking,
  getReceivedRentalBookings,
  declineResourceRequest,
  type MyBooking,
  type ReceivedBooking,
  type RentableResourceType,
  type RentalPricingUnit,
  type RentalConceptOption,
  type EquipmentUseArea,
} from '../api/rentals';
import { useAudienceOptions } from '../hooks/useAudienceOptions';
import AudiencePicker from '../components/composer/AudiencePicker';
import { confirmBooking } from '../api/availability';
import ActorProfileModal from '../components/common/ActorProfileModal';
import { resolveAudiencePayload, isExclusive } from '../components/composer/audience-payload';
import type { AudienceOption } from '../api/audience';
import VehicleFields, { buildVehicleResourceName, type VehicleSelection } from '../components/composer/VehicleFields';
import GovernedCombobox from '../components/common/GovernedCombobox';
import RentalAddressSection, { EMPTY_LOCATION, type ResourceLocationValue } from '../components/composer/RentalAddressSection';
import { searchCities, findNearestCity, type CitySearchResult } from '../api/location';
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

// Faixas de preço vindas do backend (SSOT rental_resource_pricing). "a combinar" só se não há faixas.
const formatPrice = (r: { pricingTiers?: Array<{ unit: RentalPricingUnit; priceCents: number }>; priceCents?: number | null; pricingUnit?: RentalPricingUnit | null }) => {
  if (r.pricingTiers && r.pricingTiers.length > 0) {
    return r.pricingTiers.map((t) => `${PRICING_UNIT_PT[t.unit]}: R$ ${(t.priceCents / 100).toFixed(2).replace('.', ',')}`).join(' · ');
  }
  return r.priceCents != null && r.pricingUnit
    ? `R$ ${(r.priceCents / 100).toFixed(2).replace('.', ',')} · ${PRICING_UNIT_PT[r.pricingUnit]}`
    : 'Preço a combinar';
};
// Resumo de handoff (entrega/retirada) para o card — projeta o método do backend, não inventa.
const HANDOFF_SUMMARY: Record<string, string> = {
  renter_pickup: 'Retirada no local', owner_delivery: 'Dono entrega', to_be_arranged: 'A combinar',
};
// Rótulos pt-BR do status do booking (o status é do backend; aqui só projeção).
const MY_BOOKING_STATUS: Record<string, string> = {
  requested: 'Pendente', confirmed: 'Confirmada', checked_in: 'Em uso', checked_out: 'Concluída', cancelled: 'Cancelada',
};

// Escolha amigável de entrega/devolução → 2 pernas governadas (backend valida/normaliza). Taxas: reais
// da UI → cents no envio (backend é BIGINT). O backend zera taxas que não casam com o método.
type HandoffChoice = 'pickup_return' | 'delivery' | 'collection' | 'delivery_and_collection' | 'to_be_arranged';
function handoffPayload(choice: HandoffChoice, radius: string, deliveryReais: string, collectionReais: string) {
  const cents = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 100); };
  const km = radius.trim() ? Math.max(1, parseInt(radius, 10) || 0) || null : null;
  const map: Record<HandoffChoice, { start: 'renter_pickup' | 'owner_delivery' | 'to_be_arranged'; end: 'renter_return' | 'owner_collection' | 'to_be_arranged' }> = {
    pickup_return: { start: 'renter_pickup', end: 'renter_return' },
    delivery: { start: 'owner_delivery', end: 'renter_return' },
    collection: { start: 'renter_pickup', end: 'owner_collection' },
    delivery_and_collection: { start: 'owner_delivery', end: 'owner_collection' },
    to_be_arranged: { start: 'to_be_arranged', end: 'to_be_arranged' },
  };
  const { start, end } = map[choice];
  return {
    startHandoffMethod: start,
    endHandoffMethod: end,
    deliveryRadiusKm: start === 'owner_delivery' ? km : null,
    deliveryFeeCents: start === 'owner_delivery' ? cents(deliveryReais) : null,
    collectionFeeCents: end === 'owner_collection' ? cents(collectionReais) : null,
  };
}
// Inverso (métodos do backend → escolha amigável) para prefill do modal de edição.
function handoffChoiceFromMethods(start: string | null | undefined, end: string | null | undefined): HandoffChoice {
  if (start === 'to_be_arranged' || end === 'to_be_arranged') return 'to_be_arranged';
  if (start === 'owner_delivery' && end === 'owner_collection') return 'delivery_and_collection';
  if (start === 'owner_delivery') return 'delivery';
  if (end === 'owner_collection') return 'collection';
  return 'pickup_return';
}
const centsToReais = (c: number | null | undefined) => (c != null ? (c / 100).toFixed(2).replace('.', ',') : '');

// Quilometragem: escolha da UI → payload governado. Só faz sentido em veículo (backend rejeita o resto).
// 'limited' manda km/dia + taxa (cents); unlimited/to_be_arranged mandam só a política.
function mileagePayload(isVehicle: boolean, policy: 'unlimited' | 'limited' | 'to_be_arranged', kmPerDay: string, extraFeeReais: string) {
  if (!isVehicle) return { mileagePolicy: null, includedKmPerDay: null, extraKmFeeCents: null };
  if (policy === 'limited') {
    const km = parseInt(kmPerDay, 10);
    const cents = (() => { const n = parseFloat(extraFeeReais.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 100); })();
    return { mileagePolicy: 'limited' as const, includedKmPerDay: isNaN(km) ? null : Math.max(0, km), extraKmFeeCents: cents };
  }
  return { mileagePolicy: policy, includedKmPerDay: null, extraKmFeeCents: null };
}
// Resumo pt-BR da política de km para card/detalhe (projeta o backend; não inventa).
function mileageSummary(r: { resourceType: string; mileagePolicy?: string | null; includedKmPerDay?: number | null; extraKmFeeCents?: number | null }): string | null {
  if (r.resourceType !== 'vehicle' || !r.mileagePolicy) return null;
  if (r.mileagePolicy === 'unlimited') return 'Km livre';
  if (r.mileagePolicy === 'to_be_arranged') return 'Km a combinar (direto)';
  const km = r.includedKmPerDay != null ? `Inclui ${r.includedKmPerDay} km/dia` : 'Km limitado';
  const fee = r.extraKmFeeCents != null ? ` · Excedente R$ ${(r.extraKmFeeCents / 100).toFixed(2).replace('.', ',')}/km` : '';
  return km + fee;
}
// Inverso do resolveAudiencePayload: recurso (visibility + relationshipTypes) → keys, para prefill da
// edição. Deriva do shape das options do backend, nunca inventa (mesma lei do audience-payload).
function audienceKeysFromResource(options: AudienceOption[], visibility: string, relTypes: string[] | null): string[] {
  if (visibility === 'public' || visibility === 'only_me') {
    const k = options.find((o) => o.visibility === visibility && isExclusive(o));
    return k ? [k.key] : (visibility === 'public' ? ['public'] : []);
  }
  // connections: sem relTypes = "todas as conexões" (exclusiva connections); com = as combináveis que batem.
  if (!relTypes || relTypes.length === 0) {
    const k = options.find((o) => o.visibility === 'connections' && isExclusive(o));
    return k ? [k.key] : [];
  }
  const set = new Set(relTypes);
  const keys = options.filter((o) => !isExclusive(o) && (o.audienceRelationshipTypes ?? []).length > 0 && (o.audienceRelationshipTypes ?? []).every((l) => set.has(l))).map((o) => o.key);
  return keys.length > 0 ? keys : [];
}

export default function RentalResourceListPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const { mode } = useOperatingMode();

  const [resources, setResources] = useState<MyResource[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  // Aba do modo consumir: 'rent' (buscar/alugar — foco) | 'bookings' (meus compromissos). Padrão: alugar.
  const [consumerTab, setConsumerTab] = useState<'rent' | 'bookings'>('rent');
  const [showHistory, setShowHistory] = useState(false);
  // Painel do DONO (operar): aba recursos × reservas recebidas + filtro por status (escala).
  const [profileModalActorId, setProfileModalActorId] = useState<string | null>(null); // perfil no lugar, sem sair do fluxo
  const [geoBusy, setGeoBusy] = useState(false);
  // Usar minha localização: o navegador capta o sensor (lat/lng), o BACKEND resolve a cidade (haversine).
  // O front NÃO decide proximidade nem usa lat/lng na busca — só preenche a cidade governada.
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { showToast('Seu navegador não suporta localização.', 'error'); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const city = await findNearestCity(pos.coords.latitude, pos.coords.longitude);
          if (city) { setSearchCity(city); showToast(`Cidade detectada: ${city.name}${city.stateUf ? ` · ${city.stateUf}` : ''}.`, 'success'); }
          else showToast('Não encontramos uma cidade próxima. Digite sua cidade.', 'error');
        } catch { showToast('Erro ao resolver a cidade.', 'error'); }
        finally { setGeoBusy(false); }
      },
      () => { setGeoBusy(false); showToast('Não foi possível obter sua localização. Autorize no navegador ou digite a cidade.', 'error'); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };
  const [operarTab, setOperarTab] = useState<'resources' | 'bookings'>('resources');
  const [receivedBookings, setReceivedBookings] = useState<ReceivedBooking[]>([]);
  const [receivedFilter, setReceivedFilter] = useState<'all' | 'requested' | 'confirmed' | 'cancelled'>('all');
  const reloadReceived = () => getReceivedRentalBookings().then(setReceivedBookings).catch(() => {});
  const handleOwnerConfirm = async (bookingId: string) => {
    try { await confirmBooking(bookingId); showToast('Reserva confirmada.', 'success'); reloadReceived(); }
    catch (err: any) { const m = String(err?.message || ''); showToast(m.includes('TIME_CONFLICT') ? 'Este período já foi confirmado para outra reserva.' : (m || 'Erro ao confirmar'), 'error'); }
  };
  const handleOwnerDecline = async (resourceId: string, bookingId: string, isCancel: boolean) => {
    if (!window.confirm(isCancel ? 'Cancelar esta reserva? O período volta a ficar disponível.' : 'Recusar esta solicitação?')) return;
    try { await declineResourceRequest(resourceId, bookingId); showToast(isCancel ? 'Reserva cancelada.' : 'Solicitação recusada.', 'success'); reloadReceived(); }
    catch (err: any) { showToast(err?.message || 'Erro', 'error'); }
  };
  const handleCancelMyBooking = async (bookingId: string) => {
    if (!window.confirm('Cancelar esta solicitação? Ela vai para o seu histórico (fica registrada).')) return;
    try {
      await cancelMyRentalBooking(bookingId);
      showToast('Solicitação cancelada.', 'success');
      getMyRentalBookings().then(setMyBookings).catch(() => {});
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cancelar', 'error');
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RentableResourceType | 'all'>('all');
  // Fase 5 — busca (consumir): cidade + período + raio. Backend filtra/calcula; front só projeta.
  const [searchCity, setSearchCity] = useState<CitySearchResult | null>(null);
  const [searchCep, setSearchCep] = useState('');
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');
  const [searchRadius, setSearchRadius] = useState('');
  const [discoverCards, setDiscoverCards] = useState<RentalDiscoverCard[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);

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
  const [location, setLocation] = useState<ResourceLocationValue>(EMPTY_LOCATION);
  // Modelo Airbnb: o dono decide se a reserva confirma na hora (automatic) ou precisa aprovar (manual).
  // Default 'automatic' — não esfriar o negócio (feedback Clayton 2026-07-08).
  const [approvalMode, setApprovalMode] = useState<'manual' | 'automatic'>('automatic');
  const [editApprovalMode, setEditApprovalMode] = useState<'manual' | 'automatic'>('automatic');
  const [editAudienceKeys, setEditAudienceKeys] = useState<string[]>(['public']);
  // Entrega/devolução na EDIÇÃO — mesmo modelo do cadastro (só preenche as taxas que aceita).
  const [editHandoffChoice, setEditHandoffChoice] = useState<HandoffChoice>('pickup_return');
  const [editDeliveryRadius, setEditDeliveryRadius] = useState('');
  const [editDeliveryFeeReais, setEditDeliveryFeeReais] = useState('');
  const [editCollectionFeeReais, setEditCollectionFeeReais] = useState('');
  const [editMileagePolicy, setEditMileagePolicy] = useState<'unlimited' | 'limited' | 'to_be_arranged'>('unlimited');
  const [editIncludedKmPerDay, setEditIncludedKmPerDay] = useState('');
  const [editExtraKmFeeReais, setEditExtraKmFeeReais] = useState('');
  // Entrega/devolução (handoff): uma escolha amigável que mapeia para as 2 pernas governadas do backend.
  const [handoffChoice, setHandoffChoice] = useState<'pickup_return' | 'delivery' | 'collection' | 'delivery_and_collection' | 'to_be_arranged'>('pickup_return');
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [deliveryFeeReais, setDeliveryFeeReais] = useState('');
  const [collectionFeeReais, setCollectionFeeReais] = useState('');
  // Quilometragem (só veículo). Política + km/dia + taxa excedente (R$→cents no envio).
  const [mileagePolicy, setMileagePolicy] = useState<'unlimited' | 'limited' | 'to_be_arranged'>('unlimited');
  const [includedKmPerDay, setIncludedKmPerDay] = useState('');
  const [extraKmFeeReais, setExtraKmFeeReais] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'operar') {
        if (!activeActor) { setResources([]); return; }
        setResources(await listMyRentableResources(activeActor.actor_id));
        reloadReceived(); // reservas recebidas (para as abas/filtro do dono). Não crítico se falhar.
      } else {
        const all = await listActiveRentableResources();
        // descoberta = recursos de TERCEIROS (os meus eu gerencio no operar). pricingTiers vem por card na busca.
        setResources(all.filter((r) => r.ownerActorId !== activeActor?.actor_id).map((r) => ({ ...r, pricingTiers: [] })));
        // Minhas reservas (a locação existe para os dois lados). Não crítico se falhar.
        getMyRentalBookings().then(setMyBookings).catch(() => setMyBookings([]));
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

  // Esc fecha o modal de edição sem salvar.
  useEffect(() => {
    if (!editFor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditFor(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editFor]);

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
        // catálogo por (modelo, ano, versão). Guarda o ponteiro ESTÁVEL (variant_id) — identidade única
        // da variante — + o texto p/ exibição legada (anti-verdade-paralela).
        if (vehicleSel.version) {
          metadata.vehicleVersion = vehicleSel.version.version;
          if (vehicleSel.version.variant_id) metadata.vehicleVariantId = vehicleSel.version.variant_id;
          if (vehicleSel.version.versao_nome) metadata.vehicleVersionName = vehicleSel.version.versao_nome;
        }
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
        cityId: location.city?.id ?? null, // localização governada (SSOT cities), nunca texto livre
        postalCode: location.postalCode.trim() || null,
        street: location.street.trim() || null,
        number: location.number.trim() || null,
        complement: location.complement.trim() || null,
        neighborhoodId: location.neighborhoodId,
        neighborhoodDisplay: location.neighborhoodDisplay.trim() || null,
        bookingApprovalMode: approvalMode,
        ...handoffPayload(handoffChoice, deliveryRadius, deliveryFeeReais, collectionFeeReais),
        ...mileagePayload(isVehicle, mileagePolicy, includedKmPerDay, extraKmFeeReais),
      });
      await publishProfileRef.current();
      showToast('Recurso cadastrado. Agora adicione a disponibilidade. 🗓️', 'success');
      setShowForm(false);
      setLabel(''); setDescription(''); setTierReais({}); setQuantity(1);
      setSelectedConcept(null); setLocation(EMPTY_LOCATION);
      setHandoffChoice('pickup_return'); setDeliveryRadius(''); setDeliveryFeeReais(''); setCollectionFeeReais('');
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
    try {
      const detail = await getRentalOfferDetail(resourceId);
      const reais: Partial<Record<RentalPricingUnit, string>> = {};
      detail.pricingTiers.forEach((t) => { reais[t.unit] = (t.priceCents / 100).toFixed(2).replace('.', ','); });
      setEditTierReais(reais);
      setEditQuantity(detail.resource.quantity ?? 1);
      setEditCity(detail.city ? { id: detail.city.cityId, name: detail.city.name, stateUf: detail.city.uf } : null);
      setEditDescription(detail.resource.description ?? '');
      setEditApprovalMode(detail.resource.bookingApprovalMode ?? 'automatic');
      setEditAudienceKeys(audienceKeysFromResource(audienceOptions, detail.resource.visibility, detail.resource.audienceRelationshipTypes));
      // prefill da entrega/devolução a partir dos métodos + taxas do backend.
      setEditHandoffChoice(handoffChoiceFromMethods(detail.resource.startHandoffMethod, detail.resource.endHandoffMethod));
      setEditDeliveryRadius(detail.resource.deliveryRadiusKm != null ? String(detail.resource.deliveryRadiusKm) : '');
      setEditDeliveryFeeReais(centsToReais(detail.resource.deliveryFeeCents));
      setEditCollectionFeeReais(centsToReais(detail.resource.collectionFeeCents));
      // prefill da quilometragem (só veículo tem; default unlimited se null).
      setEditMileagePolicy((detail.resource.mileagePolicy as 'unlimited' | 'limited' | 'to_be_arranged') ?? 'unlimited');
      setEditIncludedKmPerDay(detail.resource.includedKmPerDay != null ? String(detail.resource.includedKmPerDay) : '');
      setEditExtraKmFeeReais(centsToReais(detail.resource.extraKmFeeCents));
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
      const aud = resolveAudiencePayload(audienceOptions, editAudienceKeys);
      await updateRentalOffer(resourceId, {
        description: editDescription.trim() || null,
        pricingTiers,
        quantity: editQuantity,
        cityId: editCity?.id ?? null,
        visibility: aud.visibility,
        audienceRelationshipTypes: aud.audienceRelationshipTypes,
        bookingApprovalMode: editApprovalMode,
        ...handoffPayload(editHandoffChoice, editDeliveryRadius, editDeliveryFeeReais, editCollectionFeeReais),
        ...mileagePayload(resources.find((x) => x.id === resourceId)?.resourceType === 'vehicle', editMileagePolicy, editIncludedKmPerDay, editExtraKmFeeReais),
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

  if (!activeActor) {
    return <div className="rrl-page"><p>Selecione um actor para usar Locações.</p></div>;
  }

  const visible = typeFilter === 'all' ? resources : resources.filter((r) => r.resourceType === typeFilter);

  const runSearch = async () => {
    // "Onde você está" (cidade obrigatória) — o backend resolve a coord; o front nunca manda lat/lng.
    if (!searchCity) { showToast('Escolha a cidade onde você está para buscar por perto.', 'error'); return; }
    setSearchBusy(true);
    try {
      const cards = await discoverRentals({
        originCityId: searchCity.id,
        originCep: searchCep.trim() || undefined,
        radiusKm: searchRadius.trim() ? Number(searchRadius) : undefined,
        resourceType: typeFilter !== 'all' ? typeFilter : undefined,
        startAt: searchStart ? new Date(searchStart).toISOString() : undefined,
        endAt: searchEnd ? new Date(searchEnd).toISOString() : undefined,
      });
      setDiscoverCards(cards);
    } catch (err: any) {
      showToast(err?.message || 'Erro na busca', 'error');
    } finally {
      setSearchBusy(false);
    }
  };
  const formatCents = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
  const toCents = (reais: string) => { const n = parseFloat(reais.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 100); };

  // ── MODO CONSUMIR: descoberta (análogo ao Fazer compras) ──
  if (mode === 'consumir') {
    return (
      <PageModuleShell
        title="🔑 Alugar algo"
        subtitle="Imóveis, veículos, equipamentos e espaços disponíveis na comunidade."
        rail={<RightContextRail module="rentals" />}
      >
        {/* Abas: Alugar (foco) × Minhas locações (compromissos). Não empurrar a busca para baixo. */}
        {(() => { const active = myBookings.filter((b) => ['requested', 'confirmed', 'checked_in'].includes(b.status)); return (
          <div className="rrl-consumer-tabs">
            <button type="button" className={`rrl-consumer-tab ${consumerTab === 'rent' ? 'active' : ''}`} onClick={() => setConsumerTab('rent')}>🔎 Alugar</button>
            <button type="button" className={`rrl-consumer-tab ${consumerTab === 'bookings' ? 'active' : ''}`} onClick={() => setConsumerTab('bookings')}>
              🗓️ Minhas locações{active.length > 0 ? ` (${active.length})` : ''}
            </button>
          </div>
        ); })()}

        {consumerTab === 'bookings' && (() => {
          const active = myBookings.filter((b) => ['requested', 'confirmed', 'checked_in'].includes(b.status));
          const history = myBookings.filter((b) => ['cancelled', 'checked_out', 'expired'].includes(b.status));
          const renderCard = (b: MyBooking, canCancel: boolean) => (
            <div key={b.bookingId} className="rrl-mybooking">
              <div className="rrl-mybooking-head" onClick={() => navigate(`/locacoes/${b.resourceId}`)} style={{ cursor: 'pointer' }}>
                <span className="rrl-mybooking-label">{RESOURCE_TYPE_ICON[b.resourceType]} {b.resourceLabel}</span>
                <span className={`rrl-mybooking-status rrl-bk-${b.status}`}>{MY_BOOKING_STATUS[b.status] ?? b.status}</span>
              </div>
              {b.bookedStart && b.bookedEnd && <span className="rrl-mybooking-line">📅 {new Date(b.bookedStart).toLocaleString('pt-BR')} → {new Date(b.bookedEnd).toLocaleString('pt-BR')}</span>}
              <span className="rrl-mybooking-line">{b.estimate?.available ? `💰 Estimativa: R$ ${(b.estimate.estimatedPriceCents / 100).toFixed(2).replace('.', ',')}` : '💰 Preço a combinar'}</span>
              <span className="rrl-mybooking-line">👤 Dono: {b.owner.displayName}
                {b.handoffTimeStart && b.handoffTimeEnd ? ` · 🕗 ${b.handoffTimeStart.slice(0, 5)}–${b.handoffTimeEnd.slice(0, 5)}` : ''}</span>
              <div className="rrl-mybooking-actions">
                <button type="button" className="rrl-mybooking-profile" onClick={() => setProfileModalActorId(b.owner.actorId)}>Ver perfil do dono →</button>
                {canCancel && <button type="button" className="rrl-mybooking-cancel" onClick={() => handleCancelMyBooking(b.bookingId)}>Cancelar</button>}
              </div>
            </div>
          );
          return (
            <section className="rrl-mybookings">
              {active.length === 0 && history.length === 0 && <p className="rrl-status">Você ainda não solicitou nenhuma locação. Vá na aba <strong>Alugar</strong> para começar.</p>}
              {active.length > 0 && <div className="rrl-mybookings-list">{active.map((b) => renderCard(b, true))}</div>}
              {history.length > 0 && (
                <>
                  <button type="button" className="rrl-history-toggle" onClick={() => setShowHistory((v) => !v)}>
                    {showHistory ? '▾' : '▸'} Histórico ({history.length}) — canceladas/concluídas ficam registradas para reclamação ou disputa
                  </button>
                  {showHistory && <div className="rrl-mybookings-list rrl-mybookings-history">{history.map((b) => renderCard(b, false))}</div>}
                </>
              )}
            </section>
          );
        })()}

        {consumerTab === 'rent' && (<>
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

        {/* Fluxo guiado (padrão locadora, adaptado P2P): ONDE VOCÊ ESTÁ → QUANDO → resultados por
            proximidade. "Onde" = sua localização (achar o mais perto), NÃO o local de retirada — este
            é o do dono de cada anúncio. Backend resolve a coord (SSOT) e calcula distância/estimativa. */}
        <div className="rrl-search">
          <div className="rrl-search-step">
            <div className="rrl-search-step-head">
              <span className="rrl-search-step-title">📍 Onde você está</span>
              <button type="button" className="rrl-geo-btn" disabled={geoBusy} onClick={handleUseMyLocation}>
                {geoBusy ? 'Localizando…' : '📍 Usar minha localização'}
              </button>
            </div>
            <div className="rrl-search-row">
              <div className="rrl-field">Cidade *
                <GovernedCombobox<CitySearchResult> value={searchCity} onChange={setSearchCity}
                  loadOptions={(q) => searchCities(q)} getOptionKey={(c) => c.id}
                  getOptionLabel={(c) => c.stateUf ? `${c.name} · ${c.stateUf}` : c.name}
                  placeholder="Sua cidade" emptyMessage="Nenhuma cidade" />
              </div>
              <label className="rrl-field">CEP (opcional, melhora a proximidade)<input type="text" inputMode="numeric" placeholder="Ex.: 80010-000" maxLength={9} value={searchCep} onChange={(e) => setSearchCep(e.target.value)} /></label>
              <label className="rrl-field">Raio (km)<input type="number" min={1} placeholder="Ex.: 10" value={searchRadius} onChange={(e) => setSearchRadius(e.target.value)} /></label>
            </div>
          </div>
          <div className="rrl-search-step">
            <span className="rrl-search-step-title">🗓️ Quando você precisa</span>
            <div className="rrl-search-row">
              <label className="rrl-field">Retirada<input type="datetime-local" value={searchStart} onChange={(e) => setSearchStart(e.target.value)} /></label>
              <label className="rrl-field">Devolução<input type="datetime-local" value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} /></label>
              <button type="button" className="rrl-submit-btn rrl-search-go" disabled={searchBusy} onClick={runSearch}>{searchBusy ? 'Buscando…' : '🔎 Buscar por perto'}</button>
            </div>
          </div>
          <p className="rrl-hint">A retirada e a devolução acontecem no local que o dono definiu em cada anúncio — aqui você só diz onde está para ver o que tem mais perto.</p>
        </div>

        {discoverCards !== null ? (
          discoverCards.length === 0 ? (
            <p className="rrl-status">Nada encontrado com esses filtros. Tente ampliar o raio ou trocar a cidade.</p>
          ) : (
            <div className="rrl-grid">
              {discoverCards.map((c) => (
                <button key={c.id} type="button" className="rrl-card" onClick={() => navigate(`/locacoes/${c.id}`)}>
                  <span className="rrl-card-type">{RESOURCE_TYPE_ICON[c.resourceType]} {RESOURCE_TYPE_LABEL[c.resourceType]}</span>
                  <span className="rrl-card-label">{c.label}</span>
                  {(c.cityName || c.distanceKm != null) && (
                    <span className="rrl-card-desc">
                      {c.cityName ? `${c.cityName}${c.uf ? '/' + c.uf : ''}` : ''}
                      {c.distanceKm != null ? ` · ~${c.distanceKm} km de você` : ''}
                    </span>
                  )}
                  {c.estimate?.available ? (
                    <span className="rrl-card-price">≈ {formatCents(c.estimate.estimatedPriceCents)} <small style={{ fontWeight: 400, color: '#8891a6' }}>estimativa</small></span>
                  ) : c.pricingTiers.length > 0 ? (
                    <span className="rrl-card-price">{formatCents(c.pricingTiers[0].priceCents)} · {PRICING_UNIT_PT[c.pricingTiers[0].unit]}</span>
                  ) : (
                    <span className="rrl-card-price">Preço a combinar</span>
                  )}
                  {/* Entrega — o backend calculou a elegibilidade por raio (front só projeta). */}
                  {c.startHandoffMethod === 'owner_delivery' && (
                    <span className="rrl-card-delivery">
                      {c.deliveryEligible === true ? '🚚 Entrega até você' : c.deliveryEligible === false ? '🚚 Fora do raio de entrega' : '🚚 Faz entrega'}
                      {c.deliveryFeeCents != null ? ` · ${formatCents(c.deliveryFeeCents)}` : ''}
                    </span>
                  )}
                  <span className="rrl-card-cta">Ver disponibilidade →</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {loading && <p className="rrl-status">Carregando…</p>}
            {error && <p className="rrl-status rrl-error">{error}</p>}
            {!loading && !error && visible.length === 0 && (
              <p className="rrl-status">Nenhum recurso disponível {typeFilter !== 'all' ? `em ${RESOURCE_TYPE_LABEL[typeFilter as RentableResourceType]}s` : ''} ainda — use a busca acima ou troque para OPERAR e anuncie. 🚀</p>
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
          </>
        )}
        </>)}
        {profileModalActorId && <ActorProfileModal actorId={profileModalActorId} onClose={() => setProfileModalActorId(null)} />}
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

          {/* Localização TRANSVERSAL (CEP autocomplete + endereço). A verdade é cityId governado; imóvel/
              espaço pedem rua/número. Rótulos mudam por tipo. Privacidade decidida no backend. */}
          <RentalAddressSection resourceType={resourceType} value={location} onChange={setLocation} />

          {/* Modelo Airbnb: o dono decide como a reserva é aceita. Automática não esfria o negócio. */}
          <div className="rrl-field">
            Reserva
            <div className="rrl-approval">
              <button type="button" className={`rrl-approval-opt ${approvalMode === 'automatic' ? 'selected' : ''}`} onClick={() => setApprovalMode('automatic')}>
                <strong>⚡ Automática</strong><span>Confirma na hora — não faz o cliente esperar</span>
              </button>
              <button type="button" className={`rrl-approval-opt ${approvalMode === 'manual' ? 'selected' : ''}`} onClick={() => setApprovalMode('manual')}>
                <strong>✋ Eu aprovo</strong><span>Cada pedido espera a sua confirmação</span>
              </button>
            </div>
          </div>

          {/* Entrega e devolução (handoff). Imóvel/espaço não se entrega — só retira/a combinar. Taxas
              ANUNCIADAS em cents; cobrança real = PORTA-1. Backend valida/normaliza pelo tipo. */}
          <div className="rrl-field">
            Entrega e devolução
            <select className="rrl-select" value={handoffChoice} onChange={(e) => setHandoffChoice(e.target.value as HandoffChoice)}>
              <option value="pickup_return">Cliente retira e devolve no local</option>
              {(resourceType === 'vehicle' || resourceType === 'equipment') && <option value="delivery">Eu entrego</option>}
              {(resourceType === 'vehicle' || resourceType === 'equipment') && <option value="collection">Eu busco de volta</option>}
              {(resourceType === 'vehicle' || resourceType === 'equipment') && <option value="delivery_and_collection">Eu entrego e busco</option>}
            </select>
          </div>
          {(handoffChoice === 'delivery' || handoffChoice === 'delivery_and_collection') && (
            <div className="rrl-row">
              <label className="rrl-field">Entrego até (km)<input type="number" min={1} placeholder="Ex.: 15" value={deliveryRadius} onChange={(e) => setDeliveryRadius(e.target.value)} /></label>
              <label className="rrl-field">Taxa de entrega (R$)<input type="text" inputMode="decimal" placeholder="0,00" value={deliveryFeeReais} onChange={(e) => setDeliveryFeeReais(e.target.value)} /></label>
            </div>
          )}
          {(handoffChoice === 'collection' || handoffChoice === 'delivery_and_collection') && (
            <label className="rrl-field">Taxa de busca de volta (R$)<input type="text" inputMode="decimal" placeholder="0,00" value={collectionFeeReais} onChange={(e) => setCollectionFeeReais(e.target.value)} /></label>
          )}
          {(handoffChoice === 'delivery' || handoffChoice === 'collection' || handoffChoice === 'delivery_and_collection') && (
            <p className="rrl-hint">💡 Taxa anunciada — a cobrança real ainda não acontece pelo sistema.</p>
          )}

          {/* Quilometragem — SÓ veículo. Atributo da OFERTA. Taxa ANUNCIADA (cobrança real = PORTA-1). */}
          {resourceType === 'vehicle' && (
            <div className="rrl-field">
              Quilometragem
              <select className="rrl-select" value={mileagePolicy} onChange={(e) => setMileagePolicy(e.target.value as 'unlimited' | 'limited' | 'to_be_arranged')}>
                <option value="unlimited">Km livre</option>
                <option value="limited">Km limitado</option>
              </select>
              {mileagePolicy === 'limited' && (
                <div className="rrl-row" style={{ marginTop: 8 }}>
                  <label className="rrl-field">Km incluídos por dia<input type="number" min={0} placeholder="Ex.: 200" value={includedKmPerDay} onChange={(e) => setIncludedKmPerDay(e.target.value)} /></label>
                  <label className="rrl-field">Valor por km excedente (R$)<input type="text" inputMode="decimal" placeholder="Ex.: 1,50" value={extraKmFeeReais} onChange={(e) => setExtraKmFeeReais(e.target.value)} /></label>
                </div>
              )}
            </div>
          )}

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

      {/* Abas do dono: Meus recursos × Reservas recebidas. Escala: filtro por status na 2ª. */}
      {!showForm && (() => { const pend = receivedBookings.filter((b) => b.status === 'requested').length; return (
        <div className="rrl-consumer-tabs">
          <button type="button" className={`rrl-consumer-tab ${operarTab === 'resources' ? 'active' : ''}`} onClick={() => setOperarTab('resources')}>📦 Meus recursos</button>
          <button type="button" className={`rrl-consumer-tab ${operarTab === 'bookings' ? 'active' : ''}`} onClick={() => setOperarTab('bookings')}>
            📋 Reservas recebidas{pend > 0 ? ` (${pend})` : ''}
          </button>
        </div>
      ); })()}

      {!showForm && operarTab === 'bookings' && (() => {
        const counts = {
          all: receivedBookings.length,
          requested: receivedBookings.filter((b) => b.status === 'requested').length,
          confirmed: receivedBookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length,
          cancelled: receivedBookings.filter((b) => ['cancelled', 'checked_out', 'expired'].includes(b.status)).length,
        };
        const FILTERS: Array<{ key: typeof receivedFilter; label: string }> = [
          { key: 'all', label: `Todas (${counts.all})` },
          { key: 'requested', label: `Aguardando (${counts.requested})` },
          { key: 'confirmed', label: `Alugadas (${counts.confirmed})` },
          { key: 'cancelled', label: `Canceladas (${counts.cancelled})` },
        ];
        const filtered = receivedBookings.filter((b) => {
          if (receivedFilter === 'all') return true;
          if (receivedFilter === 'requested') return b.status === 'requested';
          if (receivedFilter === 'confirmed') return ['confirmed', 'checked_in'].includes(b.status);
          return ['cancelled', 'checked_out', 'expired'].includes(b.status);
        });
        return (
          <section className="rrl-received">
            <div className="rrl-filter-chips">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={`rrl-chip ${receivedFilter === f.key ? 'active' : ''}`} onClick={() => setReceivedFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            {filtered.length === 0 && <p className="rrl-status">Nenhuma reserva {receivedFilter !== 'all' ? 'neste filtro' : 'recebida ainda'}.</p>}
            <div className="rrl-mybookings-list">
              {filtered.map((b) => (
                <div key={b.bookingId} className="rrl-mybooking">
                  <div className="rrl-mybooking-head" onClick={() => navigate(`/locacoes/${b.resourceId}`)} style={{ cursor: 'pointer' }}>
                    <span className="rrl-mybooking-label">{RESOURCE_TYPE_ICON[b.resourceType]} {b.resourceLabel}</span>
                    <span className={`rrl-mybooking-status rrl-bk-${b.status}`}>{MY_BOOKING_STATUS[b.status] ?? b.status}</span>
                  </div>
                  <span className="rrl-mybooking-line">👤 {b.requester.displayName} · <span className="rrl-hint" style={{ fontWeight: 400 }}>reputação ainda não disponível</span></span>
                  {b.bookedStart && b.bookedEnd && <span className="rrl-mybooking-line">📅 {new Date(b.bookedStart).toLocaleString('pt-BR')} → {new Date(b.bookedEnd).toLocaleString('pt-BR')}</span>}
                  <span className="rrl-mybooking-line">{b.estimate?.available ? `💰 Estimativa: R$ ${(b.estimate.estimatedPriceCents / 100).toFixed(2).replace('.', ',')}` : '💰 Preço a combinar'}</span>
                  <div className="rrl-mybooking-actions">
                    <button type="button" className="rrl-mybooking-profile" onClick={() => setProfileModalActorId(b.requester.actorId)}>Ver perfil →</button>
                    {b.status === 'requested' && <button type="button" className="rrl-req-confirm-sm" onClick={() => handleOwnerConfirm(b.bookingId)}>Confirmar</button>}
                    {b.status === 'requested' && <button type="button" className="rrl-mybooking-cancel" onClick={() => handleOwnerDecline(b.resourceId, b.bookingId, false)}>Recusar</button>}
                    {['confirmed', 'checked_in'].includes(b.status) && <button type="button" className="rrl-mybooking-cancel" onClick={() => handleOwnerDecline(b.resourceId, b.bookingId, true)}>Cancelar reserva</button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {!showForm && operarTab === 'resources' && (<>
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
            {/* Retirada/devolução — projeta o handoff do backend (não inventa). */}
            {(r.startHandoffMethod || (r.handoffTimeStart && r.handoffTimeEnd)) && (
              <span className="rrl-card-handoff">
                🕗 {HANDOFF_SUMMARY[r.startHandoffMethod] ?? 'A combinar'}
                {r.resourceType !== 'space' && r.handoffTimeStart && r.handoffTimeEnd ? ` · ${r.handoffTimeStart.slice(0, 5)}–${r.handoffTimeEnd.slice(0, 5)}` : ''}
              </span>
            )}
            {mileageSummary(r) && <span className="rrl-card-handoff">🚗 {mileageSummary(r)}</span>}
            <div className="rrl-card-actions">
              <button type="button" onClick={() => navigate(`/locacoes/${r.id}`)}>Detalhes</button>
              <button type="button" onClick={() => openEdit(r.id)}>✏️ Editar</button>
              {/* Fonte ÚNICA de disponibilidade: a tela de detalhe (semântica por tipo, ISO correto).
                  O form inline foi removido — não duplicar superfície de edição de disponibilidade. */}
              <button type="button" onClick={() => navigate(`/locacoes/${r.id}`)}>🗓️ Gerenciar disponibilidade</button>
            </div>
          </div>
        ))}
      </div>
      </>)}

      {/* Modal de EDIÇÃO da oferta — largo, centralizado, com X para fechar sem salvar. */}
      {editFor && (() => {
        const r = resources.find((x) => x.id === editFor);
        return (
          <div className="rrl-modal-overlay" onClick={() => setEditFor(null)}>
            <div className="rrl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rrl-modal-head">
                <div>
                  <h2 className="rrl-modal-title">Editar anúncio</h2>
                  {r && <p className="rrl-modal-sub">{r.label}</p>}
                </div>
                <button type="button" className="rrl-modal-x" aria-label="Fechar sem salvar" onClick={() => setEditFor(null)}>✕</button>
              </div>
              <div className="rrl-modal-body">
                {/* 1 · Para quem é isso? — mesma matriz do cadastro (transversal /audience-options). */}
                <div className="rrl-field">
                  1 · Para quem é isso?
                  <AudiencePicker options={audienceOptions} selectedKeys={editAudienceKeys} onChange={setEditAudienceKeys} />
                </div>
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
                {r?.resourceType === 'equipment' && (
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
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={2000} rows={3} />
                </label>
                <div className="rrl-field">
                  Reserva
                  <div className="rrl-approval">
                    <button type="button" className={`rrl-approval-opt ${editApprovalMode === 'automatic' ? 'selected' : ''}`} onClick={() => setEditApprovalMode('automatic')}>
                      <strong>⚡ Automática</strong><span>Confirma na hora</span>
                    </button>
                    <button type="button" className={`rrl-approval-opt ${editApprovalMode === 'manual' ? 'selected' : ''}`} onClick={() => setEditApprovalMode('manual')}>
                      <strong>✋ Eu aprovo</strong><span>Espera sua confirmação</span>
                    </button>
                  </div>
                </div>
                {/* Entrega e devolução — mesmo modelo do cadastro; só preenche as taxas que aceita. */}
                <div className="rrl-field">
                  Entrega e devolução
                  <select className="rrl-select" value={editHandoffChoice} onChange={(e) => setEditHandoffChoice(e.target.value as HandoffChoice)}>
                    <option value="pickup_return">Cliente retira e devolve no local</option>
                    {(r?.resourceType === 'vehicle' || r?.resourceType === 'equipment') && <option value="delivery">Eu entrego</option>}
                    {(r?.resourceType === 'vehicle' || r?.resourceType === 'equipment') && <option value="collection">Eu busco de volta</option>}
                    {(r?.resourceType === 'vehicle' || r?.resourceType === 'equipment') && <option value="delivery_and_collection">Eu entrego e busco</option>}
                  </select>
                </div>
                {(editHandoffChoice === 'delivery' || editHandoffChoice === 'delivery_and_collection') && (
                  <div className="rrl-row">
                    <label className="rrl-field">Entrego até (km)<input type="number" min={1} placeholder="Ex.: 15" value={editDeliveryRadius} onChange={(e) => setEditDeliveryRadius(e.target.value)} /></label>
                    <label className="rrl-field">Taxa de entrega (R$)<input type="text" inputMode="decimal" placeholder="0,00" value={editDeliveryFeeReais} onChange={(e) => setEditDeliveryFeeReais(e.target.value)} /></label>
                  </div>
                )}
                {(editHandoffChoice === 'collection' || editHandoffChoice === 'delivery_and_collection') && (
                  <label className="rrl-field">Taxa de busca de volta (R$)<input type="text" inputMode="decimal" placeholder="0,00" value={editCollectionFeeReais} onChange={(e) => setEditCollectionFeeReais(e.target.value)} /></label>
                )}
                {/* Quilometragem — só veículo. */}
                {r?.resourceType === 'vehicle' && (
                  <div className="rrl-field">
                    Quilometragem
                    <select className="rrl-select" value={editMileagePolicy} onChange={(e) => setEditMileagePolicy(e.target.value as 'unlimited' | 'limited' | 'to_be_arranged')}>
                      <option value="unlimited">Km livre</option>
                      <option value="limited">Km limitado</option>
                    </select>
                    {editMileagePolicy === 'limited' && (
                      <div className="rrl-row" style={{ marginTop: 8 }}>
                        <label className="rrl-field">Km incluídos por dia<input type="number" min={0} placeholder="Ex.: 200" value={editIncludedKmPerDay} onChange={(e) => setEditIncludedKmPerDay(e.target.value)} /></label>
                        <label className="rrl-field">Valor por km excedente (R$)<input type="text" inputMode="decimal" placeholder="Ex.: 1,50" value={editExtraKmFeeReais} onChange={(e) => setEditExtraKmFeeReais(e.target.value)} /></label>
                      </div>
                    )}
                  </div>
                )}
                <p className="rrl-hint">💡 O preço e as taxas são ANÚNCIO — o pagamento em si ainda não acontece pelo sistema.</p>
              </div>
              <div className="rrl-modal-foot">
                <button type="button" className="rrl-modal-cancel" onClick={() => setEditFor(null)}>Cancelar</button>
                <button type="button" className="rrl-submit-btn" disabled={editBusy} onClick={() => handleSaveEdit(editFor)}>
                  {editBusy ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {profileModalActorId && <ActorProfileModal actorId={profileModalActorId} onClose={() => setProfileModalActorId(null)} />}
    </PageModuleShell>
  );
}
