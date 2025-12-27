// src/core/economy/region-account.service.ts
//
// Serviço para resolver conta de região para splits econômicos
// Busca regionId de tenant, usuário ou job e cria/busca conta correspondente

import { accountService } from './accounts/account.service';
import { tenantService } from '../tenants/tenant.service';
import { worldService } from '../world/services/world.service';
import type { FastifyBaseLogger } from 'fastify';

interface ResolveRegionAccountParams {
  tenantId: string;
  userId?: string;
  jobId?: string;
}

class RegionAccountService {
  constructor(
    private readonly accountService: any, // AccountService instance
    private readonly logger?: FastifyBaseLogger
  ) {}

  /**
   * Resolve regionAccountId para splits econômicos
   * Prioridade:
   * 1. Região do tenant (tenant.cityId → stateId → regionId)
   * 2. Região do usuário (se existir no perfil)
   * 3. Região do job (se existir location/city)
   * 4. Retorna undefined se não encontrar
   */
  async resolveRegionAccountId(
    params: ResolveRegionAccountParams
  ): Promise<string | undefined> {
    const { tenantId, userId, jobId } = params;
    let regionId: string | undefined;
    let foundSource: string | undefined;

    // 1) Tentar pegar regionId do tenant (via cityId)
    try {
      const tenant = await tenantService.getTenantById(tenantId);
      if (tenant?.cityId) {
        const cityPath = await worldService.getCityFullPath(tenant.cityId);
        if (cityPath?.state?.stateId) {
          // Usar stateId como regionId (por enquanto)
          // TODO: Se houver tabela de regions separada, mapear city → region
          regionId = cityPath.state.stateId;
          foundSource = 'tenant';
        }
      }
    } catch (error) {
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
    // REGRA GLOBAL: TOLERÂNCIA A DADOS AUSENTES
    // ==========================================
    // Se não encontrou regionId, retornar undefined (não erro)
    // O chamador deve tratar o caso de região não configurada
    if (!regionId) {
      // Permitir undefined em qualquer ambiente (não apenas test)
      // O chamador deve tratar o caso de região não configurada
      if (this.logger) {
        this.logger.warn({
          tenantId,
          userId: userId || null,
          jobId: jobId || null,
          'economy.action': 'resolve-region-account',
        }, 'No region configured for tenant - returning undefined');
      }
      return undefined;
    }

    // Buscar ou criar conta economy para essa região
    // Usar stateId como identificador da região (por enquanto)
    // TODO: Se houver tabela de regions, usar regionId diretamente
    try {
      const regionAccounts = await this.accountService.getAccountsByOwner(
        tenantId,
        regionId,
        'group', // Usar 'group' como ownerType temporário para regiões
      );

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
    } catch (error) {
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

export const regionAccountService = new RegionAccountService(
  accountService
);

