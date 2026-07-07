// src/api/rentals.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-B — client do CRUD de recurso alugável (GET/POST/PATCH
// /rentable-resources). Agenda/reserva do recurso usam o client JÁ EXISTENTE (api/availability.ts)
// com ownerType='rentable_resource' — nenhuma rota nova além do registro do recurso em si.

import { apiFetchJson } from './client';

export type RentableResourceType = 'equipment' | 'vehicle' | 'property' | 'space' | 'other';
export type RentableResourceStatus = 'active' | 'paused' | 'retired';
// DECISION-0151 ADENDO A — projeção do vocabulário governado RENTAL_PRICING_UNITS (fonte: backend)
export type RentalPricingUnit = 'por_hora' | 'por_dia' | 'por_semana' | 'por_mes';
export const PRICING_UNIT_PT: Record<RentalPricingUnit, string> = { por_hora: 'Por hora', por_dia: 'Por dia (diária)', por_semana: 'Por semana', por_mes: 'Por mês' };

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
  metadata?: Record<string, unknown>;
}): Promise<RentableResource> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource }>('/rentable-resources', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
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

// CONSUMIR (descoberta) — freio 'sem discovery' da SLICE-B revogado por Clayton 2026-07-07
export async function listActiveRentableResources(): Promise<RentableResource[]> {
  const res = await apiFetchJson<{ ok: boolean; data: RentableResource[] }>('/rentable-resources?status=active&limit=50');
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
  q?: string
): Promise<RentalConceptOption[]> {
  const params = new URLSearchParams({ resourceType });
  if (q?.trim()) params.set('q', q.trim());
  const res = await apiFetchJson<{ ok: boolean; data: RentalConceptOption[] }>(
    `/rentable-resources/concepts?${params.toString()}`
  );
  return res.data;
}

// Catálogo GOVERNADO marca/modelo (capacidade transversal — 2026-07-07)
export interface VehicleMake { id: string; slug: string; name: string; }
export interface VehicleModel { id: string; makeId: string; slug: string; name: string; }

export async function searchVehicleMakes(q?: string): Promise<VehicleMake[]> {
  const params = new URLSearchParams(); if (q?.trim()) params.set('q', q.trim());
  const res = await apiFetchJson<{ ok: boolean; data: VehicleMake[] }>(`/catalog/vehicles/makes?${params.toString()}`);
  return res.data;
}

export async function listVehicleModels(makeId: string, q?: string): Promise<VehicleModel[]> {
  const params = new URLSearchParams(); if (q?.trim()) params.set('q', q.trim());
  const res = await apiFetchJson<{ ok: boolean; data: VehicleModel[] }>(`/catalog/vehicles/makes/${makeId}/models?${params.toString()}`);
  return res.data;
}
