// src/core/city/city-readiness/city-readiness.service.ts
// Serviço de prontidão de cidade - READ-ONLY, diagnóstico estrutural

import { runQueryWithTenant, runQueriesWithTenant, pool } from '../../database/pool';
import { decisionLogService } from '../../decision-log/decision-log.service';
import { worldService } from '../../world/services/world.service';
import type { CityReadiness } from './city-readiness.types';

/**
 * Serviço de prontidão de cidade
 * READ-ONLY: apenas verifica e diagnostica, não executa nada
 */
class CityReadinessService {
  /**
   * Obtém prontidão de uma cidade
   * READ-ONLY: não executa, não decide, apenas diagnostica
   */
  async getCityReadiness(cityId: string): Promise<CityReadiness | null> {
    // Obter tenantId e regionId da cidade
    const cityData = await this.getCityData(cityId);
    if (!cityData) {
      return null; // Cidade não encontrada
    }

    const { tenantId, regionId } = cityData;

    // Detectar módulos ativos
    const activeModules = await this.detectActiveModules(tenantId, cityId);

    // Verificar dependências faltantes
    const missingDependencies = await this.detectMissingDependencies(
      tenantId,
      cityId
    );

    // Verificar economia
    const economyReady = await this.checkEconomyReady(tenantId);
    const usersCount = await this.getUsersCount(tenantId);
    const transactionsLast30Days = await this.getTransactionsLast30Days(
      tenantId
    );

    // Verificar prontidão por módulo
    const canActivate = {
      work: await this.canActivateWork(tenantId, cityId),
      rides: await this.canActivateRides(tenantId, cityId),
      marketplace: await this.canActivateMarketplace(tenantId, cityId),
      fund: await this.canActivateFund(tenantId, cityId),
    };

    // Coletar motivos (reasons)
    const reasons: Record<string, string[]> = {};
    if (!canActivate.work) {
      reasons.work = await this.getWorkBlockers(tenantId, cityId);
    }
    if (!canActivate.rides) {
      reasons.rides = await this.getRidesBlockers(tenantId, cityId);
    }
    if (!canActivate.marketplace) {
      reasons.marketplace = await this.getMarketplaceBlockers(tenantId, cityId);
    }
    if (!canActivate.fund) {
      reasons.fund = await this.getFundBlockers(tenantId, cityId);
    }

    const result: CityReadiness = {
      cityId,
      regionId,
      activeModules,
      missingDependencies,
      economyReady,
      usersCount,
      transactionsLast30Days,
      canActivate,
      reasons,
    };

    // Log estruturado para diagnóstico
    await this.logReadinessCheck(tenantId, cityId, result);

    return result;
  }

  /**
   * Obtém dados básicos da cidade
   */
  private async getCityData(
    cityId: string
  ): Promise<{ tenantId: string; regionId: string } | null> {
    // Buscar cidade sem RLS (precisa do tenantId primeiro)
    const cityResult = await pool.query<{
      tenant_id: string;
      region_id: string | null;
    }>(
      `
      SELECT tenant_id, region_id
      FROM rides_cities
      WHERE city_id = $1
      LIMIT 1
      `,
      [cityId]
    );

    if (cityResult.rows.length > 0) {
      const tenantId = cityResult.rows[0].tenant_id;
      let regionId = cityResult.rows[0].region_id || 'unknown';

      // Se não tem region_id, tentar obter via world service
      if (regionId === 'unknown') {
        try {
          const cityPath = await worldService.getCityFullPath(cityId);
          if (cityPath?.state?.stateId) {
            regionId = cityPath.state.stateId;
          }
        } catch (error) {
          console.warn('[CityReadiness] Erro ao obter regionId via world:', error);
        }
      }

      return { tenantId, regionId };
    }

    // Tentar obter de world_cities
    try {
      const worldCity = await worldService.getCityById(cityId);
      if (worldCity) {
        // Para world_cities, precisamos do tenantId de outra forma
        // Por enquanto, retornar null se não encontrar em rides_cities
        return null;
      }
    } catch (error) {
      console.warn('[CityReadiness] Erro ao buscar cidade no world:', error);
    }

    return null;
  }

  /**
   * Detecta módulos ativos na cidade
   */
  private async detectActiveModules(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const modules: string[] = [];

    // Verificar WORK (workers ativos)
    const workersCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM workers
        WHERE tenant_id = $1 AND is_active = TRUE
        `,
        values: [tenantId],
      }
    );
    if (parseInt(workersCount?.count || '0', 10) > 0) {
      modules.push('work');
    }

    // Verificar RIDES (cidade ativa e motoristas)
    const ridesActive = await runQueryWithTenant<{ is_active: boolean }>(
      tenantId,
      {
        text: `
        SELECT is_active
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        LIMIT 1
        `,
        values: [tenantId, cityId],
      }
    );
    if (ridesActive?.is_active === true) {
      const driversCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        {
          text: `
          SELECT COUNT(*)::text AS count
          FROM rides_drivers
          WHERE tenant_id = $1
          `,
          values: [tenantId],
        }
      );
      if (parseInt(driversCount?.count || '0', 10) > 0) {
        modules.push('rides');
      }
    }

    // Verificar MARKETPLACE (merchants com produtos)
    const merchantsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(DISTINCT merchant_id)::text AS count
        FROM (
          SELECT merchant_id FROM product_offers WHERE tenant_id = $1
          UNION
          SELECT merchant_id FROM local_products WHERE tenant_id = $1
        ) AS merchants
        `,
        values: [tenantId],
      }
    );
    if (parseInt(merchantsCount?.count || '0', 10) > 0) {
      modules.push('marketplace');
    }

    // Verificar FUND (conta de região existe)
    const regionAccount = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      {
        text: `
        SELECT EXISTS(
          SELECT 1 FROM accounts
          WHERE tenant_id = $1
            AND account_type = 'group'
            AND metadata->>'is_region_account' = 'true'
        ) AS exists
        `,
        values: [tenantId],
      }
    );
    if (regionAccount?.exists === true) {
      modules.push('fund');
    }

    return modules;
  }

  /**
   * Detecta dependências faltantes
   */
  private async detectMissingDependencies(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const missing: string[] = [];

    // Verificar economy (contas)
    const accountsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM accounts
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(accountsCount?.count || '0', 10) === 0) {
      missing.push('economy.accounts');
    }

    // Verificar rides (zonas)
    const zonesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_zones
        WHERE tenant_id = $1 AND city_id = $2 AND is_active = TRUE
        `,
        values: [tenantId, cityId],
      }
    );
    if (parseInt(zonesCount?.count || '0', 10) === 0) {
      missing.push('rides.zones');
    }

    // Verificar rides (tipos de serviço)
    const serviceTypesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_service_types
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(serviceTypesCount?.count || '0', 10) === 0) {
      missing.push('rides.service_types');
    }

    // Verificar rides (pricing)
    const pricingCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_pricing_config
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(pricingCount?.count || '0', 10) === 0) {
      missing.push('rides.pricing');
    }

    return missing;
  }

  /**
   * Verifica se economia está pronta
   */
  private async checkEconomyReady(tenantId: string): Promise<boolean> {
    const accountsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM accounts
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    return parseInt(accountsCount?.count || '0', 10) > 0;
  }

  /**
   * Obtém contagem de usuários
   */
  private async getUsersCount(tenantId: string): Promise<number> {
    const usersCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM users
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    return parseInt(usersCount?.count || '0', 10);
  }

  /**
   * Obtém transações dos últimos 30 dias
   */
  private async getTransactionsLast30Days(tenantId: string): Promise<number> {
    const transactionsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM transactions
        WHERE tenant_id = $1
          AND createdAt >= NOW() - INTERVAL '30 days'
        `,
        values: [tenantId],
      }
    );
    return parseInt(transactionsCount?.count || '0', 10);
  }

  /**
   * Verifica se pode ativar WORK
   */
  private async canActivateWork(
    tenantId: string,
    cityId: string
  ): Promise<boolean> {
    // Economy deve estar pronto
    if (!(await this.checkEconomyReady(tenantId))) {
      return false;
    }

    // Deve haver workers
    const workersCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM workers
        WHERE tenant_id = $1 AND is_active = TRUE
        `,
        values: [tenantId],
      }
    );
    return parseInt(workersCount?.count || '0', 10) > 0;
  }

  /**
   * Verifica se pode ativar RIDES
   */
  private async canActivateRides(
    tenantId: string,
    cityId: string
  ): Promise<boolean> {
    // Cidade deve estar ativa
    const city = await runQueryWithTenant<{ is_active: boolean }>(
      tenantId,
      {
        text: `
        SELECT is_active
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        LIMIT 1
        `,
        values: [tenantId, cityId],
      }
    );
    if (!city || !city.is_active) {
      return false;
    }

    // Deve haver zonas
    const zonesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_zones
        WHERE tenant_id = $1 AND city_id = $2 AND is_active = TRUE
        `,
        values: [tenantId, cityId],
      }
    );
    if (parseInt(zonesCount?.count || '0', 10) === 0) {
      return false;
    }

    // Deve haver tipos de serviço
    const serviceTypesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_service_types
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(serviceTypesCount?.count || '0', 10) === 0) {
      return false;
    }

    // Deve haver pricing
    const pricingCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_pricing_config
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(pricingCount?.count || '0', 10) === 0) {
      return false;
    }

    // Deve haver motoristas
    const driversCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_drivers
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(driversCount?.count || '0', 10) === 0) {
      return false;
    }

    // Deve haver veículos
    const vehiclesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_vehicles
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    return parseInt(vehiclesCount?.count || '0', 10) > 0;
  }

  /**
   * Verifica se pode ativar MARKETPLACE
   */
  private async canActivateMarketplace(
    tenantId: string,
    cityId: string
  ): Promise<boolean> {
    // Cidade deve estar ativa (verificar rides_cities)
    const city = await runQueryWithTenant<{ is_active: boolean }>(
      tenantId,
      {
        text: `
        SELECT is_active
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        LIMIT 1
        `,
        values: [tenantId, cityId],
      }
    );
    if (!city || !city.is_active) {
      return false;
    }

    // Deve haver merchants com produtos
    const merchantsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(DISTINCT merchant_id)::text AS count
        FROM (
          SELECT merchant_id FROM product_offers WHERE tenant_id = $1
          UNION
          SELECT merchant_id FROM local_products WHERE tenant_id = $1
        ) AS merchants
        `,
        values: [tenantId],
      }
    );
    return parseInt(merchantsCount?.count || '0', 10) > 0;
  }

  /**
   * Verifica se pode ativar FUND
   */
  private async canActivateFund(
    tenantId: string,
    cityId: string
  ): Promise<boolean> {
    // Economy deve estar pronto
    if (!(await this.checkEconomyReady(tenantId))) {
      return false;
    }

    // Deve haver conta de região
    const regionAccount = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      {
        text: `
        SELECT EXISTS(
          SELECT 1 FROM accounts
          WHERE tenant_id = $1
            AND account_type = 'group'
            AND metadata->>'is_region_account' = 'true'
        ) AS exists
        `,
        values: [tenantId],
      }
    );
    return regionAccount?.exists === true;
  }

  /**
   * Obtém motivos de bloqueio para WORK
   */
  private async getWorkBlockers(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const blockers: string[] = [];

    if (!(await this.checkEconomyReady(tenantId))) {
      blockers.push('Economy não está pronto (contas não existem)');
    }

    const workersCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM workers
        WHERE tenant_id = $1 AND is_active = TRUE
        `,
        values: [tenantId],
      }
    );
    if (parseInt(workersCount?.count || '0', 10) === 0) {
      blockers.push('Nenhum worker ativo cadastrado');
    }

    return blockers;
  }

  /**
   * Obtém motivos de bloqueio para RIDES
   */
  private async getRidesBlockers(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const blockers: string[] = [];

    const city = await runQueryWithTenant<{ is_active: boolean }>(
      tenantId,
      {
        text: `
        SELECT is_active
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        LIMIT 1
        `,
        values: [tenantId, cityId],
      }
    );
    if (!city || !city.is_active) {
      blockers.push('Cidade não está ativa (is_active = false)');
    }

    const zonesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_zones
        WHERE tenant_id = $1 AND city_id = $2 AND is_active = TRUE
        `,
        values: [tenantId, cityId],
      }
    );
    if (parseInt(zonesCount?.count || '0', 10) === 0) {
      blockers.push('Nenhuma zona ativa definida');
    }

    const serviceTypesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_service_types
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(serviceTypesCount?.count || '0', 10) === 0) {
      blockers.push('Nenhum tipo de serviço configurado');
    }

    const pricingCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_pricing_config
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(pricingCount?.count || '0', 10) === 0) {
      blockers.push('Pricing não configurado');
    }

    const driversCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_drivers
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(driversCount?.count || '0', 10) === 0) {
      blockers.push('Nenhum motorista cadastrado');
    }

    const vehiclesCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM rides_vehicles
        WHERE tenant_id = $1
        `,
        values: [tenantId],
      }
    );
    if (parseInt(vehiclesCount?.count || '0', 10) === 0) {
      blockers.push('Nenhum veículo cadastrado');
    }

    return blockers;
  }

  /**
   * Obtém motivos de bloqueio para MARKETPLACE
   */
  private async getMarketplaceBlockers(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const blockers: string[] = [];

    const city = await runQueryWithTenant<{ is_active: boolean }>(
      tenantId,
      {
        text: `
        SELECT is_active
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        LIMIT 1
        `,
        values: [tenantId, cityId],
      }
    );
    if (!city || !city.is_active) {
      blockers.push('Cidade não está ativa');
    }

    const merchantsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(DISTINCT merchant_id)::text AS count
        FROM (
          SELECT merchant_id FROM product_offers WHERE tenant_id = $1
          UNION
          SELECT merchant_id FROM local_products WHERE tenant_id = $1
        ) AS merchants
        `,
        values: [tenantId],
      }
    );
    if (parseInt(merchantsCount?.count || '0', 10) === 0) {
      blockers.push('Nenhum merchant com produtos cadastrado');
    }

    return blockers;
  }

  /**
   * Obtém motivos de bloqueio para FUND
   */
  private async getFundBlockers(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const blockers: string[] = [];

    if (!(await this.checkEconomyReady(tenantId))) {
      blockers.push('Economy não está pronto (contas não existem)');
    }

    const regionAccount = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      {
        text: `
        SELECT EXISTS(
          SELECT 1 FROM accounts
          WHERE tenant_id = $1
            AND account_type = 'group'
            AND metadata->>'is_region_account' = 'true'
        ) AS exists
        `,
        values: [tenantId],
      }
    );
    if (!regionAccount?.exists) {
      blockers.push('Conta de região não criada');
    }

    return blockers;
  }

  /**
   * Log estruturado para diagnóstico
   */
  private async logReadinessCheck(
    tenantId: string,
    cityId: string,
    result: CityReadiness
  ): Promise<void> {
    // Log para cidades não prontas
    const notReadyModules = Object.entries(result.canActivate)
      .filter(([_, canActivate]) => !canActivate)
      .map(([module]) => module);

    if (notReadyModules.length > 0) {
      console.log(
        JSON.stringify({
          module: 'city-readiness',
          eventType: 'city_not_ready',
          tenantId,
          cityId,
          regionId: result.regionId,
          notReadyModules,
          missingDependencies: result.missingDependencies,
          reasons: result.reasons,
          economyReady: result.economyReady,
          usersCount: result.usersCount,
          transactionsLast30Days: result.transactionsLast30Days,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Log para dependências ausentes
    if (result.missingDependencies.length > 0) {
      console.log(
        JSON.stringify({
          module: 'city-readiness',
          eventType: 'missing_dependencies',
          tenantId,
          cityId,
          regionId: result.regionId,
          missingDependencies: result.missingDependencies,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Registrar no Decision Log
    try {
      await decisionLogService.createObservation(
        'economy',
        'city_readiness_check',
        {
          cityId,
          regionId: result.regionId,
        },
        0,
        {
          metadata: {
            activeModules: result.activeModules,
            missingDependencies: result.missingDependencies,
            economyReady: result.economyReady,
            usersCount: result.usersCount,
            transactionsLast30Days: result.transactionsLast30Days,
            canActivate: result.canActivate,
            reasons: result.reasons,
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error('[CityReadiness] Erro ao registrar no Decision Log:', error);
    }
  }
}

export const cityReadinessService = new CityReadinessService();


