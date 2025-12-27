"use strict";
// src/core/economy/fund/fund.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundService = void 0;
const account_service_1 = require("../accounts/account.service");
const tenant_service_1 = require("../../tenants/tenant.service");
const world_service_1 = require("../../world/services/world.service");
const region_account_service_1 = require("../region-account.service");
const pool_1 = require("@core/database/pool");
class FundService {
    /**
     * Obtém resumo do fundo regional
     */
    async getSummary(tenantId) {
        // 1. Obter região do tenant
        const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
        let regionId = 'unknown';
        if (tenant?.cityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
            if (cityPath?.state?.stateId) {
                regionId = cityPath.state.stateId;
            }
        }
        // 2. Resolver conta de região (pode ser conta 'group' criada pelo regionAccountService)
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
        });
        if (!regionAccountId) {
            // Se não há conta de região, retornar valores zerados
            return {
                regionId,
                balance: 0,
                transactions: 0,
                sources: {
                    work: 0,
                },
                lastUpdated: new Date().toISOString(),
            };
        }
        // 3. Obter saldo da conta de região
        const balance = await account_service_1.accountService.getBalance(tenantId, regionAccountId);
        // 4. Buscar transações da conta de região
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            // Buscar transações onde to_account é a conta de região e metadata indica split REGION do módulo work
            const result = await client.query(`
        SELECT transaction_id, amount, created_at, metadata
        FROM transactions
        WHERE to_account = $1
          AND metadata->>'module' = 'work'
          AND metadata->>'splitTargetType' = 'REGION'
        ORDER BY created_at DESC
        LIMIT 1000
        `, [regionAccountId]);
            const allTransactions = result.rows;
            const workTotal = allTransactions.reduce((sum, row) => sum + parseFloat(row.amount), 0);
            // Obter última atualização
            const lastTransaction = allTransactions[0];
            const lastUpdated = lastTransaction?.created_at
                ? lastTransaction.created_at.toISOString()
                : new Date().toISOString();
            return {
                regionId,
                balance,
                transactions: allTransactions.length,
                sources: {
                    work: workTotal,
                },
                lastUpdated,
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtém histórico do fundo regional agregado por dia
     */
    async getHistory(tenantId, rangeDays = 30) {
        // 1. Resolver conta de região
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
        });
        if (!regionAccountId) {
            return [];
        }
        // 2. Buscar transações agregadas por dia
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - rangeDays);
            // Buscar transações onde to_account é a conta de região, metadata.module = 'work' e splitTargetType = 'REGION'
            const result = await client.query(`
        SELECT 
          DATE(created_at) as date,
          SUM(amount) as amount
        FROM transactions
        WHERE to_account = $1
          AND metadata->>'module' = 'work'
          AND metadata->>'splitTargetType' = 'REGION'
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        `, [regionAccountId, startDate, endDate]);
            // Converter para formato esperado
            const history = result.rows.map((row) => ({
                date: row.date,
                amount: parseFloat(row.amount),
            }));
            return history;
        }
        finally {
            client.release();
        }
    }
}
exports.fundService = new FundService();
//# sourceMappingURL=fund.service.js.map