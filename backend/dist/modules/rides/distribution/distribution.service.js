"use strict";
// src/modules/rides/distribution/distribution.service.ts
// SPRINT 4: INTEGRATED WITH UNIFY BANK
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributionService = exports.DistributionService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const bank_integration_service_1 = require("../../bank/bank-integration.service");
class DistributionService {
    // ========================================================================
    // 🔹 1. Processar pagamento final da corrida (INTEGRADO COM UNIFY BANK)
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
        // 2. Processar pagamento via Unify Bank
        const bankResult = await bank_integration_service_1.bankIntegrationService.processRidePayment(tenantId, {
            rideId: ride_id,
            passengerUserId: passenger_user_id,
            driverUserId: driverUserId,
            amountCents: price.total,
            currency: 'BRL',
            idempotencyKey: `ride-${ride_id}`,
            metadata: {
                driverId: driver_id,
                finalPrice: price.total,
            },
        });
        // 3. Extrair valores dos splits para compatibilidade com registro histórico
        const { bankAccountService } = await Promise.resolve().then(() => __importStar(require('../../bank/bank-account.service')));
        const driverAccount = await bankAccountService.getAccountByOwner(tenantId, driverUserId, 'user', 'BRL');
        const feeAccount = await bankAccountService.getSystemAccount(tenantId, 'fee', 'BRL');
        const driverSplitAmount = bankResult.splits.find((s) => s.accountId === driverAccount?.accountId)?.amount || 0;
        const feeSplitAmount = bankResult.splits.find((s) => s.accountId === feeAccount?.accountId)?.amount || 0;
        const driverAmount = driverSplitAmount;
        const platformAmount = feeSplitAmount; // Fee vai para plataforma
        const communityAmount = 0; // Por enquanto, rides não têm community fund
        // 4. Gravar histórico no banco (compatibilidade)
        await this.recordDistribution(tenantId, ride_id, price, driverAmount, platformAmount, communityAmount);
        // 5. Armazenar bankTransactionId no ride (via metadata JSONB)
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_rides
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('bankTransactionId', $3)
        WHERE tenant_id = $1 AND ride_id = $2
      `,
            values: [tenantId, ride_id, bankResult.transactionId],
        });
        // 6. Emitir evento de pagamento concluído
        await event_bus_1.eventBus.emit({
            type: "rides.payment.completed",
            tenantId,
            payload: {
                rideId: ride_id,
                totalCents: price.total,
                driverAmount,
                platformAmount,
                communityAmount,
                bankTransactionId: bankResult.transactionId,
            },
        });
        return {
            ok: true,
            driverAmount,
            platformAmount,
            communityAmount,
            bankTransactionId: bankResult.transactionId,
            splits: bankResult.splits,
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
    applyDistribution(totalCents, rule) {
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
        calculatedAt
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
        ORDER BY calculatedAt DESC
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
            totalCents: ride.final_price || 0,
        };
        return this.processRidePayment(tenantId, ride, price);
    }
}
exports.DistributionService = DistributionService;
exports.distributionService = new DistributionService();
