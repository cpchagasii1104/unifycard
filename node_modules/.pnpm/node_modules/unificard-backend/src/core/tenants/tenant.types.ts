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

