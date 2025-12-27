import type { Tenant, SetTenantRegionInput } from './tenant.types';
declare class TenantService {
    tenantExists(tenantId: string): Promise<boolean>;
    getTenantById(tenantId: string): Promise<Tenant | null>;
    /**
     * Define a região do tenant (país, estado, cidade)
     * Usa root-config como fallback se algum campo não for fornecido
     */
    setTenantRegion(tenantId: string, input: SetTenantRegionInput): Promise<Tenant>;
}
export declare const tenantService: TenantService;
export {};
//# sourceMappingURL=tenant.service.d.ts.map