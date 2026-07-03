// src/api/rentals.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-B — client do CRUD de recurso alugável (GET/POST/PATCH
// /rentable-resources). Agenda/reserva do recurso usam o client JÁ EXISTENTE (api/availability.ts)
// com ownerType='rentable_resource' — nenhuma rota nova além do registro do recurso em si.

import { apiFetchJson } from './client';

export type RentableResourceType = 'equipment' | 'vehicle' | 'property' | 'space' | 'other';
export type RentableResourceStatus = 'active' | 'paused' | 'retired';

export interface RentableResource {
  id: string;
  tenantId: string;
  ownerActorId: string;
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description: string | null;
  categoryId: string | null;
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
