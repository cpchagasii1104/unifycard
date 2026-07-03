// backend/src/modules/rentals/rentable-resource.types.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151 Opção B, FASE 2a substrato já vivo desde
// 20260624120000). Esta fatia só adiciona a SUPERFÍCIE HTTP sobre `rentable_resources` — o registro
// do recurso alugável. Availability/booking/confirm JÁ são genéricos por owner_type e não mudam aqui
// (POST /availability + POST /bookings + PUT /bookings/:id já aceitam 'rentable_resource').

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

export interface RentableResourceRow {
  id: string;
  tenant_id: string;
  owner_actor_id: string;
  concept_id: string;
  resource_type: RentableResourceType;
  label: string;
  description: string | null;
  category_id: string | null;
  status: RentableResourceStatus;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRentableResourceInput {
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description?: string | null;
  categoryId?: string | null;
}

export interface ListRentableResourcesFilters {
  ownerActorId?: string;
  status?: RentableResourceStatus;
  limit?: number;
  offset?: number;
}
