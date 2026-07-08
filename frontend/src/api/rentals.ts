// src/api/rentals.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-B — client do CRUD de recurso alugável (GET/POST/PATCH
// /rentable-resources). Agenda/reserva do recurso usam o client JÁ EXISTENTE (api/availability.ts)
// com ownerType='rentable_resource' — nenhuma rota nova além do registro do recurso em si.

import { apiFetchJson } from './client';

// 'other' REMOVIDO (2026-07-07, GO Clayton): anti-padrão de ontologia. 5º tipo entra por RFC.
export type RentableResourceType = 'equipment' | 'vehicle' | 'property' | 'space';
export type RentableResourceStatus = 'active' | 'paused' | 'retired';
export type BookingApprovalMode = 'manual' | 'automatic';
export type StartHandoffMethod = 'renter_pickup' | 'owner_delivery' | 'to_be_arranged';
export type EndHandoffMethod = 'renter_return' | 'owner_collection' | 'to_be_arranged';
// DECISION-0151 ADENDO A — projeção do vocabulário governado RENTAL_PRICING_UNITS (fonte: backend)
export type RentalPricingUnit = 'por_hora' | 'por_dia' | 'por_semana' | 'por_mes' | 'por_semestre' | 'por_ano';
// Ordem de exibição das faixas (do menor pro maior período).
export const RENTAL_PRICING_UNITS: RentalPricingUnit[] = ['por_hora', 'por_dia', 'por_semana', 'por_mes', 'por_semestre', 'por_ano'];
export const PRICING_UNIT_PT: Record<RentalPricingUnit, string> = { por_hora: 'Por hora', por_dia: 'Por dia (diária)', por_semana: 'Por semana', por_mes: 'Por mês', por_semestre: 'Por semestre', por_ano: 'Por ano' };

export interface RentableResource {
  id: string;
  tenantId: string;
  ownerActorId: string;
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description: string | null;
  categoryId: string | null;
  pricingUnit: RentalPricingUnit | null;
  priceCents: number | null;
  resourceYear: number | null;
  quantity: number;
  bookingApprovalMode: BookingApprovalMode;
  startHandoffMethod: StartHandoffMethod;
  endHandoffMethod: EndHandoffMethod;
  deliveryRadiusKm: number | null;
  deliveryFeeCents: number | null;
  collectionFeeCents: number | null;
  metadata: Record<string, unknown>;
  status: RentableResourceStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createRentableResource(input: {
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description?: string | null;
  pricingUnit?: RentalPricingUnit | null;
  priceCents?: number | null;
  resourceYear?: number | null;
  metadata?: Record<string, unknown>;
  visibility?: 'public' | 'connections' | 'only_me';
  audienceRelationshipTypes?: string[] | null;
  cityId?: string | null; // localização governada (SSOT cities) — backend valida; nunca texto livre
  postalCode?: string | null; // CEP opcional — refina proximidade; backend resolve, nunca o front
  pricingTiers?: Array<{ unit: RentalPricingUnit; priceCents: number }>; // faixas; priceCents (cents)
  quantity?: number; // unidades da oferta (equipment pode >1; veículo/imóvel/espaço = 1)
  bookingApprovalMode?: BookingApprovalMode; // Airbnb: dono decide auto/manual no cadastro
  startHandoffMethod?: StartHandoffMethod; endHandoffMethod?: EndHandoffMethod;
  deliveryRadiusKm?: number | null; deliveryFeeCents?: number | null; collectionFeeCents?: number | null;
}): Promise<RentableResource> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource }>('/rentable-resources', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

// Detalhe da oferta para o form de edição (faixas + cidade). O dono edita a OFERTA, não a identidade.
export interface RentalOfferDetail {
  resource: RentableResource;
  pricingTiers: Array<{ unit: RentalPricingUnit; priceCents: number }>;
  city: { cityId: string; name: string; uf: string | null } | null;
}
export async function getRentalOfferDetail(id: string): Promise<RentalOfferDetail> {
  const res = await apiFetchJson<{ ok: boolean; data: RentalOfferDetail }>(`/rentable-resources/${id}/offer`);
  return res.data;
}

// Edita a OFERTA (dono do anúncio). Dinheiro em cents. Backend valida autoridade (canRepresentActor).
export async function updateRentalOffer(id: string, input: {
  description?: string | null;
  visibility?: 'public' | 'connections' | 'only_me';
  audienceRelationshipTypes?: string[] | null;
  pricingTiers?: Array<{ unit: RentalPricingUnit; priceCents: number }>;
  quantity?: number;
  cityId?: string | null;
  bookingApprovalMode?: BookingApprovalMode;
  startHandoffMethod?: StartHandoffMethod; endHandoffMethod?: EndHandoffMethod;
  deliveryRadiusKm?: number | null; deliveryFeeCents?: number | null; collectionFeeCents?: number | null;
}): Promise<RentableResource> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource }>(`/rentable-resources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return res.data;
}

// Fase 5 — DESCOBERTA com filtros. Backend filtra/calcula (distância, estimativa); o front só projeta.
export interface RentalDiscoverCard {
  id: string; label: string; resourceType: RentableResourceType; description: string | null;
  cityName: string | null; uf: string | null; distanceKm: number | null; quantity: number;
  pricingTiers: Array<{ unit: RentalPricingUnit; priceCents: number }>;
  estimate: { available: boolean; estimatedPriceCents: number; disclaimer: string } | null;
  startHandoffMethod: StartHandoffMethod; endHandoffMethod: EndHandoffMethod;
  deliveryRadiusKm: number | null; deliveryFeeCents: number | null; collectionFeeCents: number | null;
  deliveryEligible: boolean | null;
  metadata: Record<string, unknown>;
}
// Padrão locadora adaptado P2P: o consumidor manda ONDE ESTÁ (cidade obrigatória + CEP opcional) e
// QUANDO. O backend resolve a coord da origem (SSOT) e calcula distância/estimativa — o front NUNCA
// manda lat/lng. O local de retirada/devolução é o do DONO de cada anúncio, não escolha do consumidor.
export async function discoverRentals(f: {
  originCityId?: string; originCep?: string; radiusKm?: number; resourceType?: string; startAt?: string; endAt?: string;
}): Promise<RentalDiscoverCard[]> {
  const p = new URLSearchParams();
  if (f.originCityId) p.set('originCityId', f.originCityId);
  if (f.originCep) p.set('originCep', f.originCep);
  if (f.radiusKm) p.set('radiusKm', String(f.radiusKm));
  if (f.resourceType) p.set('resourceType', f.resourceType);
  if (f.startAt) p.set('startAt', f.startAt);
  if (f.endAt) p.set('endAt', f.endAt);
  const res = await apiFetchJson<{ ok: boolean; data: RentalDiscoverCard[] }>(`/rentable-resources/discover?${p.toString()}`);
  return res.data;
}

// Disponibilidade PÚBLICA de um recurso (consumidor que chegou pela busca/descoberta). Só janelas
// ativas de recurso público — a agenda operacional privada NÃO é exposta. Backend é a autoridade.
export interface PublicAvailabilityWindow { availabilityId: string; startDatetime: string; endDatetime: string; }
export async function getResourcePublicAvailability(id: string): Promise<PublicAvailabilityWindow[]> {
  const res = await apiFetchJson<{ ok: boolean; data: PublicAvailabilityWindow[] }>(`/rentable-resources/${id}/availability`);
  return res.data;
}

// Solicitar/reservar uma janela (modelo Airbnb). O modo (auto/manual) é do DONO, decidido no backend.
// Retorna o status final: 'confirmed' (auto) ou 'requested' (manual). Pré-dinheiro.
export interface BookingResult { bookingId: string; status: string; autoConfirmed: boolean }
// startAt/endAt = SUBPERÍODO desejado dentro da janela (locação por período). Sem eles = janela inteira.
// O backend valida que o período está contido na janela.
export async function requestResourceBooking(resourceId: string, availabilityId: string, startAt?: string, endAt?: string): Promise<BookingResult> {
  const res = await apiFetchJson<{ ok: boolean; data: BookingResult }>(`/rentable-resources/${resourceId}/book`, {
    method: 'POST',
    body: JSON.stringify({ availabilityId, startAt, endAt }),
  });
  return res.data;
}

// Solicitações pendentes que o DONO vê antes de confirmar (ato de confiança: ele vai ceder um bem).
// requester = projeção pública do actor (anti-PII). trust = null enquanto reputação não está viva.
export interface RentalRequest {
  bookingId: string;
  requester: { actorId: string; displayName: string; actorType: string; avatarUrl: string | null };
  bookedStart: string | null;
  bookedEnd: string | null;
  requestedAt: string;
  estimate: { available: boolean; estimatedPriceCents: number } | null;
  trust: null | { completedRentals?: number; cancellations?: number; averageRating?: number };
}
export async function getResourceRequests(resourceId: string): Promise<RentalRequest[]> {
  const res = await apiFetchJson<{ ok: boolean; data: RentalRequest[] }>(`/rentable-resources/${resourceId}/requests`);
  return res.data;
}
export async function declineResourceRequest(resourceId: string, bookingId: string): Promise<void> {
  await apiFetchJson(`/rentable-resources/${resourceId}/requests/${bookingId}/decline`, { method: 'POST' });
}

export async function listMyRentableResources(ownerActorId: string): Promise<RentableResource[]> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource[] }>(
    `/rentable-resources?ownerActorId=${encodeURIComponent(ownerActorId)}`
  );
  return res.data;
}

export async function getRentableResource(id: string): Promise<RentableResource> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource }>(`/rentable-resources/${id}`);
  return res.data;
}

export async function updateRentableResourceStatus(
  id: string,
  status: RentableResourceStatus
): Promise<RentableResource> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource }>(`/rentable-resources/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

// CONSUMIR (descoberta) — filtrada pela PLATEIA do dono no BACKEND (viewer server-side).
// discover=true → o backend decide o que o viewer pode ver; frontend só projeta.
export async function listActiveRentableResources(): Promise<RentableResource[]> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource[] }>('/rentable-resources?discover=true&limit=50');
  return res.data;
}

// 2026-07-07 (fix Clayton): catálogo GOVERNADO filtrado por TIPO — "primeiro o tipo, aí sim a
// categoria relacionada" (mesma lógica de /demands/concepts). Sem texto livre.
export interface RentalConceptOption {
  concept_id: string;
  slug: string;
  domain: string;
  label: string;
}

export async function listRentalConceptsByType(
  resourceType: RentableResourceType,
  q?: string,
  useArea?: string | null
): Promise<RentalConceptOption[]> {
  const params = new URLSearchParams({ resourceType });
  if (q?.trim()) params.set('q', q.trim());
  if (useArea) params.set('useArea', useArea);
  const res = await apiFetchJson<{ ok: boolean; data: RentalConceptOption[] }>(
    `/rentable-resources/concepts?${params.toString()}`
  );
  return res.data;
}

// Faceta GOVERNADA de uso de equipamento (RFC-RENTAL-EQUIPMENT-USE-AREAS-MVP). Frontend só projeta.
export interface EquipmentUseArea { code: string; label: string; concept_count: number; }
export async function listEquipmentUseAreas(): Promise<EquipmentUseArea[]> {
  const res = await apiFetchJson<{ ok: boolean; data: EquipmentUseArea[] }>(
    `/rentable-resources/equipment-use-areas`
  );
  return res.data;
}

// Catálogo GOVERNADO marca/modelo (capacidade transversal — 2026-07-07)
export interface VehicleMake { id: string; slug: string; name: string; }
export interface VehicleModel { id: string; makeId: string; conceptId: string; slug: string; name: string; }

// conceptId filtra as marcas pela CATEGORIA escolhida (só marcas que fazem aquele tipo). Backend decide.
export async function searchVehicleMakes(q?: string, conceptId?: string): Promise<VehicleMake[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  if (conceptId) params.set('conceptId', conceptId);
  const res = await apiFetchJson<{ ok: boolean; data: VehicleMake[] }>(`/catalog/vehicles/makes?${params.toString()}`);
  return res.data;
}

// conceptId OBRIGATÓRIO (fix 2ª IA: modelo pertence a marca+TIPO — CG160 é moto, não carro,
// mesmo sendo Honda; sem isso, Civic e CG160 apareceriam juntos só por serem da mesma marca).
export async function listVehicleModels(makeId: string, conceptId: string, q?: string): Promise<VehicleModel[]> {
  const params = new URLSearchParams({ conceptId }); if (q?.trim()) params.set('q', q.trim());
  const res = await apiFetchJson<{ ok: boolean; data: VehicleModel[] }>(`/catalog/vehicles/makes/${makeId}/models?${params.toString()}`);
  return res.data;
}

// Anos GOVERNADOS do modelo (F-VEHICLE-MODEL-YEAR). O front NÃO decide validade — só lista o que vem.
export async function listVehicleModelYears(modelId: string): Promise<number[]> {
  const res = await apiFetchJson<{ ok: boolean; data: number[] }>(`/catalog/vehicles/models/${modelId}/years`);
  return res.data;
}

// Versão (trim) + ficha técnica AUTO-COMPLETADA. A verdade é do catálogo — o anunciante não digita spec.
export interface VehicleVersionSpec {
  version: string;
  motor?: string | null; cilindrada_cc?: number | null; potencia_cv?: number | null; torque_kgfm?: number | null;
  combustivel?: string | null; tracao?: string | null; cambio?: string | null; num_portas?: number | null;
  capacidade_carga_kg?: number | null; peso_kg?: number | null;
  comprimento_cm?: number | null; largura_cm?: number | null; altura_cm?: number | null; entre_eixos_cm?: number | null;
  pneus?: string | null; freios_diant?: string | null; freios_tras?: string | null;
  suspensao_diant?: string | null; suspensao_tras?: string | null; direcao?: string | null;
  tanque_litros?: number | null; cacamba_litros?: number | null;
}
export async function listVehicleVersions(modelId: string, year: number): Promise<VehicleVersionSpec[]> {
  const res = await apiFetchJson<{ ok: boolean; data: VehicleVersionSpec[] }>(
    `/catalog/vehicles/models/${modelId}/years/${year}/versions`);
  return res.data;
}
