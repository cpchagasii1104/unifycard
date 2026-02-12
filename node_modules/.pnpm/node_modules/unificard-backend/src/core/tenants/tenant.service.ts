// backend/src/core/tenants/tenant.service.ts
import { pool } from '@core/database/pool';
import { worldService } from '../world/services/world.service';
import { rootConfigService } from '../root-config/root-config.service';
import type { Tenant, SetTenantRegionInput } from './tenant.types';

class TenantService {
  // Note: tabela tenants NÃO usa RLS – é tabela de sistema
  async tenantExists(tenantId: string): Promise<boolean> {
    const result = await pool.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenants WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const result = await pool.query<{
      tenant_id: string;
      name: string;
      slug: string;
      city_id: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      'SELECT tenant_id, name, slug, city_id, createdAt, updatedAt FROM tenants WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      cityId: row.city_id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Define a região do tenant (país, estado, cidade)
   * Usa root-config como fallback se algum campo não for fornecido
   */
  async setTenantRegion(
    tenantId: string,
    input: SetTenantRegionInput
  ): Promise<Tenant> {
    // Verificar se tenant existe
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    // Obter root-config como fallback
    const rootConfig = await rootConfigService.getConfig();

    // Determinar valores finais (input tem prioridade sobre root-config)
    let finalCountryId = input.countryId ?? rootConfig?.countryId ?? null;
    let finalStateId = input.stateId ?? rootConfig?.stateId ?? null;
    let finalCityId = input.cityId ?? rootConfig?.cityId ?? null;

    // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
    if (finalCityId) {
      const cityPath = await worldService.getCityFullPath(finalCityId);
      if (!cityPath) {
        throw new Error('Cidade não encontrada');
      }
      finalStateId = cityPath.state.stateId;
      finalCountryId = cityPath.country.countryId;
    } else if (finalStateId) {
      // Se stateId foi fornecido, validar e obter countryId automaticamente
      const state = await worldService.getStateById(finalStateId);
      if (!state) {
        throw new Error('Estado não encontrado');
      }
      finalCountryId = state.countryId;
    } else if (finalCountryId) {
      // Validar se país existe
      const country = await worldService.getCountryById(finalCountryId);
      if (!country) {
        throw new Error('País não encontrado');
      }
    }

    // Validar hierarquia se todos os campos foram fornecidos
    if (finalStateId && finalCountryId) {
      const state = await worldService.getStateById(finalStateId);
      if (!state || state.countryId !== finalCountryId) {
        throw new Error('Estado não pertence ao país especificado');
      }
    }

    if (finalCityId && finalStateId) {
      const city = await worldService.getCityById(finalCityId);
      if (!city || city.stateId !== finalStateId) {
        throw new Error('Cidade não pertence ao estado especificado');
      }
    }

    // Atualizar apenas city_id no tenant (país e estado são derivados da cidade)
    const updateResult = await pool.query<{
      tenant_id: string;
      name: string;
      slug: string;
      city_id: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `UPDATE tenants 
       SET city_id = $1, updatedAt = now()
       WHERE tenant_id = $2
       RETURNING tenant_id, name, slug, city_id, createdAt, updatedAt`,
      [finalCityId, tenantId]
    );

    const updatedRow = updateResult.rows[0];
    if (!updatedRow) {
      throw new Error('Erro ao atualizar tenant');
    }

    return {
      tenantId: updatedRow.tenant_id,
      name: updatedRow.name,
      slug: updatedRow.slug,
      cityId: updatedRow.city_id,
      createdAt: updatedRow.createdAt,
      updatedAt: updatedRow.updatedAt,
    };
  }
}

export const tenantService = new TenantService();

