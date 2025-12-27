"use strict";
// src/core/economy/region-account.service.ts
//
// Serviço para resolver conta de região para splits econômicos
// Busca regionId de tenant, usuário ou job e cria/busca conta correspondente
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionAccountService = void 0;
const account_service_1 = require("./accounts/account.service");
const tenant_service_1 = require("../tenants/tenant.service");
const world_service_1 = require("../world/services/world.service");
class RegionAccountService {
    accountService;
    logger;
    constructor(accountService, // AccountService instance
    logger) {
        this.accountService = accountService;
        this.logger = logger;
    }
    /**
     * Resolve regionAccountId para splits econômicos
     * Prioridade:
     * 1. Região do tenant (tenant.cityId → stateId → regionId)
     * 2. Região do usuário (se existir no perfil)
     * 3. Região do job (se existir location/city)
     * 4. Retorna undefined se não encontrar
     */
    async resolveRegionAccountId(params) {
        const { tenantId, userId, jobId } = params;
        let regionId;
        let foundSource;
        // 1) Tentar pegar regionId do tenant (via cityId)
        try {
            const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
            if (tenant?.cityId) {
                const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
                if (cityPath?.state?.stateId) {
                    // Usar stateId como regionId (por enquanto)
                    // TODO: Se houver tabela de regions separada, mapear city → region
                    regionId = cityPath.state.stateId;
                    foundSource = 'tenant';
                }
            }
        }
        catch (error) {
            // Log mas não quebra
            if (this.logger) {
                this.logger.warn({
                    tenantId,
                    err: error,
                    'economy.action': 'resolve-region-account',
                }, 'Error resolving region from tenant');
            }
        }
        // 2) Se não encontrou no tenant, tentar do usuário (se userId fornecido)
        if (!regionId && userId) {
            // TODO: Implementar busca de região do usuário quando houver perfil com localização
            // Por enquanto, não há campo de região no perfil do usuário
            // Exemplo futuro:
            // const userProfile = await userService.getProfile(userId);
            // if (userProfile?.cityId) {
            //   const cityPath = await worldService.getCityFullPath(userProfile.cityId);
            //   regionId = cityPath.state.stateId;
            //   foundSource = 'user';
            // }
        }
        // 3) Se ainda não encontrou, tentar do job (se jobId fornecido)
        if (!regionId && jobId) {
            // TODO: Implementar busca de região do job quando houver campo de localização
            // Por enquanto, jobs não têm campo de localização direto
            // Exemplo futuro:
            // const job = await jobService.getById(tenantId, jobId);
            // if (job?.cityId || job?.location?.cityId) {
            //   const cityPath = await worldService.getCityFullPath(job.cityId);
            //   regionId = cityPath.state.stateId;
            //   foundSource = 'job';
            // }
        }
        // ==========================================
        // REGRA GLOBAL: ZERO FALLBACK SILENCIOSO
        // ==========================================
        // Se não encontrou regionId, lançar erro explícito (exceto em test)
        if (!regionId) {
            if (process.env.NODE_ENV === 'test') {
                // Em test, permitir undefined para compatibilidade
                if (this.logger) {
                    this.logger.warn({
                        tenantId,
                        userId: userId || null,
                        jobId: jobId || null,
                        foundSource: null,
                        'economy.action': 'resolve-region-account',
                    }, 'No region found for split context (test mode)');
                }
                return undefined;
            }
            // Em produção, erro explícito
            const error = new Error(`Region not found for tenant ${tenantId}. Configure cityId in tenant or provide userId/jobId with location.`);
            if (this.logger) {
                this.logger.error({
                    tenantId,
                    userId: userId || null,
                    jobId: jobId || null,
                    'economy.action': 'resolve-region-account',
                }, 'Region resolution failed - no fallback allowed');
            }
            throw error;
        }
        // Buscar ou criar conta economy para essa região
        // Usar stateId como identificador da região (por enquanto)
        // TODO: Se houver tabela de regions, usar regionId diretamente
        try {
            const regionAccounts = await this.accountService.getAccountsByOwner(tenantId, regionId, 'group');
            let regionAccount = regionAccounts[0];
            if (!regionAccount) {
                // Criar conta para a região
                regionAccount = await this.accountService.createAccount(tenantId, {
                    ownerId: regionId,
                    ownerType: 'group', // TODO: Mudar para 'region' quando disponível
                    currency: 'BRL',
                });
            }
            if (this.logger) {
                this.logger.info({
                    tenantId,
                    userId: userId || null,
                    jobId: jobId || null,
                    regionId,
                    foundSource,
                    accountId: regionAccount.accountId,
                    'economy.action': 'resolve-region-account',
                }, 'Resolved region account for split');
            }
            return regionAccount.accountId;
        }
        catch (error) {
            if (this.logger) {
                this.logger.error({
                    tenantId,
                    regionId,
                    err: error,
                    'economy.action': 'resolve-region-account',
                }, 'Error creating/finding region account');
            }
            return undefined;
        }
    }
}
exports.regionAccountService = new RegionAccountService(account_service_1.accountService);
//# sourceMappingURL=region-account.service.js.map