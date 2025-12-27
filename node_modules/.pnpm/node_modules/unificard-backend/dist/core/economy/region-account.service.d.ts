import type { FastifyBaseLogger } from 'fastify';
interface ResolveRegionAccountParams {
    tenantId: string;
    userId?: string;
    jobId?: string;
}
declare class RegionAccountService {
    private readonly accountService;
    private readonly logger?;
    constructor(accountService: any, // AccountService instance
    logger?: FastifyBaseLogger | undefined);
    /**
     * Resolve regionAccountId para splits econômicos
     * Prioridade:
     * 1. Região do tenant (tenant.cityId → stateId → regionId)
     * 2. Região do usuário (se existir no perfil)
     * 3. Região do job (se existir location/city)
     * 4. Retorna undefined se não encontrar
     */
    resolveRegionAccountId(params: ResolveRegionAccountParams): Promise<string | undefined>;
}
export declare const regionAccountService: RegionAccountService;
export {};
//# sourceMappingURL=region-account.service.d.ts.map