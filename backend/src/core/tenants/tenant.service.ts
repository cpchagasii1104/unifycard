// backend/src/core/tenants/tenant.service.ts
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { worldService } from '../world/services/world.service';
import { rootConfigService } from '../root-config/root-config.service';
import { bootstrapTenantContexts } from './tenant-context-bootstrap.service';
import type { CreateTenantInput, Tenant, SetTenantRegionInput } from './tenant.types';

type Queryable = Pick<PoolClient, 'query'>;

async function queryTenantById(executor: Queryable, tenantId: string): Promise<Tenant | null> {
  type RowWithCity = {
    id: string;
    name: string;
    slug: string;
    city_id: string | null;
    created_at: Date;
    updated_at: Date;
  };
  type RowBase = {
    id: string;
    name: string;
    slug: string;
    created_at: Date;
    updated_at: Date;
  };

  let result;
  try {
    result = await executor.query<RowWithCity>(
      'SELECT id, name, slug, city_id, created_at, updated_at FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId]
    );
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    const msg = e instanceof Error ? e.message : String(e);
    if (code === '42703' && msg.includes('city_id')) {
      result = await executor.query<RowBase & { city_id?: null }>(
        'SELECT id, name, slug, created_at, updated_at FROM tenants WHERE id = $1 LIMIT 1',
        [tenantId]
      );
    } else {
      throw e;
    }
  }

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    tenantId: row.id,
    name: row.name,
    slug: row.slug,
    cityId: 'city_id' in row && row.city_id != null ? row.city_id : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

async function assertProfessionalAuthority(executor: Queryable, tenantId: string): Promise<void> {
  const r = await executor.query<{ permission: string }>(
    `SELECT permission FROM tenant_contexts WHERE tenant_id = $1 AND context = 'professional' LIMIT 1`,
    [tenantId]
  );
  const perm = r.rows[0]?.permission;
  if (perm !== 'read' && perm !== 'write' && perm !== 'admin') {
    throw new Error('TENANT_BOOTSTRAP_INVALID: context professional ausente ou permissão inválida');
  }
}

class TenantService {
  // Note: tabela tenants NÃO usa RLS – é tabela de sistema
  async tenantExists(tenantId: string): Promise<boolean> {
    const result = await pool.query<{ id: string }>(
      'SELECT id FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    return queryTenantById(pool, tenantId);
  }

  /**
   * Único ponto de criação de tenant: INSERT + bootstrap tenant_contexts na mesma transação.
   * @param outerClient — se definido, participa da transação do chamador (sem BEGIN/COMMIT aqui).
   */
  async createTenant(input: CreateTenantInput, outerClient?: PoolClient): Promise<Tenant> {
    const tenantId = input.id ?? randomUUID();

    const run = async (client: PoolClient) => {
      await client.query(
        `INSERT INTO tenants (id, name, slug, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())`,
        [tenantId, input.name, input.slug]
      );
      await bootstrapTenantContexts(tenantId, client);
      await assertProfessionalAuthority(client, tenantId);
    };

    if (outerClient) {
      await run(outerClient);
      const tenant = await queryTenantById(outerClient, tenantId);
      if (!tenant) {
        throw new Error('TENANT_CREATE_FAILED: tenant não visível na transação corrente');
      }
      return tenant;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await run(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const tenant = await queryTenantById(pool, tenantId);
    if (!tenant) {
      throw new Error('TENANT_CREATE_FAILED: tenant não encontrado após transação');
    }
    return tenant;
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
      id: string;
      name: string;
      slug: string;
      city_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE tenants 
       SET city_id = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, name, slug, city_id, created_at, updated_at`,
      [finalCityId, tenantId]
    );

    const updatedRow = updateResult.rows[0];
    if (!updatedRow) {
      throw new Error('Erro ao atualizar tenant');
    }

    return {
      tenantId: updatedRow.id,
      name: updatedRow.name,
      slug: updatedRow.slug,
      cityId: updatedRow.city_id,
      createdAt: updatedRow.created_at instanceof Date ? updatedRow.created_at.toISOString() : String(updatedRow.created_at),
      updatedAt: updatedRow.updated_at instanceof Date ? updatedRow.updated_at.toISOString() : String(updatedRow.updated_at),
    };
  }
}

export const tenantService = new TenantService();

