"use strict";
// src/modules/rides/distribution/distribution.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributionService = exports.DistributionService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const account_service_1 = require("@core/economy/accounts/account.service");
const split_service_1 = require("@core/economy/split.service");
const region_account_service_1 = require("@core/economy/region-account.service");
const group_account_service_1 = require("@core/economy/group-account.service");
class DistributionService {
    // ========================================================================
    // 🔹 1. Processar pagamento final da corrida (INTEGRADO COM SPLITENGINE)
    // ========================================================================
    async processRidePayment(tenantId, ride, price) {
        const { ride_id, passenger_user_id, driver_id } = ride;
        // 1. Buscar user_id do driver (driver_id é ID do driver, não userId)
        const driverRow = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT user_id
          FROM rides_drivers
          WHERE tenant_id = $1 AND driver_id = $2
          LIMIT 1
        `,
            values: [tenantId, driver_id],
        });
        if (!driverRow) {
            throw new errors_1.NotFoundError('Driver not found');
        }
        const driverUserId = driverRow.user_id;
        // 2. Buscar contas financeiras (usar currency do ride ou default 'BRL')
        // Nota: Por enquanto usa 'BRL', mas pode ser expandido para usar currency do ride
        const currency = 'BRL'; // TODO: Adicionar currency ao ride quando necessário
        const passengerAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, passenger_user_id, currency);
        const driverAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, driverUserId, currency);
        const tenantAccount = await account_service_1.accountService.getPlatformAccount(tenantId, currency);
        // 3. Resolver regionAccountId e groupAccountIds para splits
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
            userId: driverUserId,
        });
        const groupAccountIds = await group_account_service_1.groupAccountService.resolveGroupAccountIds({
            tenantId,
            userId: driverUserId,
        });
        // 4. Preparar contexto para SplitEngine
        const splitContext = {
            tenantId,
            amount: price.total,
            currency,
            source: 'rides',
            customerAccountId: passengerAccount.accountId,
            workerAccountId: driverAccount.accountId,
            tenantAccountId: tenantAccount.accountId,
            regionAccountId,
            groupAccountIds,
            metadata: {
                module: 'rides',
                type: 'ride_payment',
                rideId: ride_id,
                driverId: driver_id,
                driverUserId,
                passengerUserId: passenger_user_id,
            },
        };
        // 5. Aplicar splits via SplitEngine
        const splitResult = await split_service_1.splitEngineService.applySplits(splitContext);
        // 6. Extrair valores para compatibilidade com registro histórico
        const driverSplit = splitResult.splits.find(s => s.rule.targetType === 'WORKER');
        const platformSplit = splitResult.splits.find(s => s.rule.targetType === 'TENANT');
        const regionSplit = splitResult.splits.find(s => s.rule.targetType === 'REGION');
        const groupSplits = splitResult.splits.filter(s => s.rule.targetType === 'GROUP');
        const driverAmount = driverSplit?.amount || 0;
        const platformAmount = platformSplit?.amount || 0;
        const regionAmount = regionSplit?.amount || 0;
        const groupAmount = groupSplits.reduce((sum, s) => sum + s.amount, 0);
        // 7. Gravar histórico no banco (compatibilidade)
        await this.recordDistribution(tenantId, ride_id, price, driverAmount, platformAmount, regionAmount + groupAmount // communityAmount agora inclui region + groups
        );
        // 8. Emitir evento de pagamento concluído
        await event_bus_1.eventBus.emit({
            type: "rides.payment.completed",
            tenantId,
            payload: {
                rideId: ride_id,
                total: price.total,
                driverAmount,
                platformAmount,
                regionAmount,
                groupAmount,
                splits: splitResult.splits,
            },
        });
        return {
            ok: true,
            driverAmount,
            platformAmount,
            regionAmount,
            groupAmount,
            splits: splitResult.splits,
        };
    }
    // ========================================================================
    // 🔹 2. Obter regra de distribuição
    // ========================================================================
    async getDistributionRule(tenantId, serviceTypeId) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_distribution_rules
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
            values: [tenantId, serviceTypeId],
        });
    }
    // ========================================================================
    // 🔹 3. Aplicar regra de distribuição
    // ========================================================================
    applyDistribution(total, rule) {
        const platformAmount = +(total * (rule.platform_pct / 100)).toFixed(2);
        const communityAmount = rule.community_fund_enabled
            ? +(total * (rule.community_pct / 100)).toFixed(2)
            : 0;
        const driverAmount = +(total - platformAmount - communityAmount).toFixed(2);
        return {
            driverAmount,
            platformAmount,
            communityAmount,
        };
    }
    // ========================================================================
    // 🔹 4. Registrar distribuição no banco
    // ========================================================================
    async recordDistribution(tenantId, rideId, price, driverAmount, platformAmount, communityAmount) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_ride_distributions (
        tenant_id, ride_id,
        total_amount, driver_amount,
        platform_amount, community_amount,
        calculated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6, now())
      `,
            values: [
                tenantId,
                rideId,
                price.total,
                driverAmount,
                platformAmount,
                communityAmount,
            ],
        });
    }
    // ========================================================================
    // 🔹 5. Transferir valores entre contas (DEPRECATED - usar SplitEngine)
    // ========================================================================
    // NOTA: Este método foi mantido para compatibilidade, mas não é mais usado
    // O SplitEngine agora gerencia todas as transferências automaticamente
    async transferFunds(tenantId, passengerAccount, driverAccount, platformAccount, communityFundAccount, driverAmount, platformAmount, communityAmount, rideId) {
        // Método mantido para compatibilidade, mas não deve ser chamado
        // SplitEngine já gerencia todas as transferências
        console.warn('[DistributionService] transferFunds called but should use SplitEngine instead');
    }
    // ========================================================================
    // 🔹 6. Obter distribuição por rideId
    // ========================================================================
    async getByRideId(tenantId, rideId) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_ride_distributions
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY calculated_at DESC
        LIMIT 1
      `,
            values: [tenantId, rideId],
        });
    }
    // ========================================================================
    // 🔹 7. Aplicar distribuição em uma corrida
    // ========================================================================
    async applyDistributionToRide(tenantId, rideId, options) {
        // Buscar ride
        const ride = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
            values: [tenantId, rideId],
        });
        if (!ride) {
            throw new errors_1.NotFoundError('Ride not found');
        }
        // Calcular preço (simplificado - pode ser melhorado)
        const price = {
            total: ride.final_price || 0,
        };
        return this.processRidePayment(tenantId, ride, price);
    }
}
exports.DistributionService = DistributionService;
exports.distributionService = new DistributionService();
//# sourceMappingURL=distribution.service.js.map