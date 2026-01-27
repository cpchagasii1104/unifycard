"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantService = void 0;
// backend/src/core/tenants/tenant.service.ts
const pool_1 = require("@core/database/pool");
const world_service_1 = require("../world/services/world.service");
const root_config_service_1 = require("../root-config/root-config.service");
class TenantService {
    // Note: tabela tenants NÃO usa RLS – é tabela de sistema
    async tenantExists(tenantId) {
        const result = await pool_1.pool.query('SELECT tenant_id FROM tenants WHERE tenant_id = $1 LIMIT 1', [tenantId]);
        return (result.rowCount ?? 0) > 0;
    }
    async getTenantById(tenantId) {
        const result = await pool_1.pool.query('SELECT tenant_id, name, slug, city_id, created_at, updated_at FROM tenants WHERE tenant_id = $1 LIMIT 1', [tenantId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return {
            tenantId: row.tenant_id,
            name: row.name,
            slug: row.slug,
            cityId: row.city_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Define a região do tenant (país, estado, cidade)
     * Usa root-config como fallback se algum campo não for fornecido
     */
    async setTenantRegion(tenantId, input) {
        // Verificar se tenant existe
        const tenant = await this.getTenantById(tenantId);
        if (!tenant) {
            throw new Error('Tenant não encontrado');
        }
        // Obter root-config como fallback
        const rootConfig = await root_config_service_1.rootConfigService.getConfig();
        // Determinar valores finais (input tem prioridade sobre root-config)
        let finalCountryId = input.countryId ?? rootConfig?.countryId ?? null;
        let finalStateId = input.stateId ?? rootConfig?.stateId ?? null;
        let finalCityId = input.cityId ?? rootConfig?.cityId ?? null;
        // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
        if (finalCityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(finalCityId);
            if (!cityPath) {
                throw new Error('Cidade não encontrada');
            }
            finalStateId = cityPath.state.stateId;
            finalCountryId = cityPath.country.countryId;
        }
        else if (finalStateId) {
            // Se stateId foi fornecido, validar e obter countryId automaticamente
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state) {
                throw new Error('Estado não encontrado');
            }
            finalCountryId = state.countryId;
        }
        else if (finalCountryId) {
            // Validar se país existe
            const country = await world_service_1.worldService.getCountryById(finalCountryId);
            if (!country) {
                throw new Error('País não encontrado');
            }
        }
        // Validar hierarquia se todos os campos foram fornecidos
        if (finalStateId && finalCountryId) {
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state || state.countryId !== finalCountryId) {
                throw new Error('Estado não pertence ao país especificado');
            }
        }
        if (finalCityId && finalStateId) {
            const city = await world_service_1.worldService.getCityById(finalCityId);
            if (!city || city.stateId !== finalStateId) {
                throw new Error('Cidade não pertence ao estado especificado');
            }
        }
        // Atualizar apenas city_id no tenant (país e estado são derivados da cidade)
        const updateResult = await pool_1.pool.query(`UPDATE tenants 
       SET city_id = $1, updated_at = now()
       WHERE tenant_id = $2
       RETURNING tenant_id, name, slug, city_id, created_at, updated_at`, [finalCityId, tenantId]);
        const updatedRow = updateResult.rows[0];
        if (!updatedRow) {
            throw new Error('Erro ao atualizar tenant');
        }
        return {
            tenantId: updatedRow.tenant_id,
            name: updatedRow.name,
            slug: updatedRow.slug,
            cityId: updatedRow.city_id,
            createdAt: updatedRow.created_at,
            updatedAt: updatedRow.updated_at,
        };
    }
}
exports.tenantService = new TenantService();
