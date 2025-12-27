export interface Tenant {
    tenantId: string;
    name: string;
    slug: string;
    cityId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface SetTenantRegionInput {
    countryId?: string | null;
    stateId?: string | null;
    cityId?: string | null;
}
//# sourceMappingURL=tenant.types.d.ts.map