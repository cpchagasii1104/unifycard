// backend/src/core/tenants/tenant.types.ts
export interface Tenant {
  tenantId: string;
  name: string;
  slug: string;
  cityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetTenantRegionInput {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
}

/** Único contrato de criação de tenant (INSERT estrito + bootstrap tenant_contexts na mesma transação). */
export interface CreateTenantInput {
  id?: string;
  name: string;
  slug: string;
}

