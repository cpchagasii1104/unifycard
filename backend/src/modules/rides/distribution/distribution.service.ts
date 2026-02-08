// src/modules/rides/distribution/distribution.service.ts
// SPRINT 4: INTEGRATED WITH UNIFY BANK

import { runQueryWithTenant } from "@core/db";
import { eventBus } from "@core/events/event-bus";
import { BadRequestError, NotFoundError } from "@core/errors";
import { bankIntegrationService } from "../../bank/bank-integration.service";

export class DistributionService {

  // ========================================================================
  // 🔹 1. Processar pagamento final da corrida (INTEGRADO COM UNIFY BANK)
  // ========================================================================
  async processRidePayment(tenantId: string, ride: any, price: any) {
    const { ride_id, passenger_user_id, driver_id } = ride;

    // 1. Buscar user_id do driver (driver_id é ID do driver, não userId)
    const driverRow = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      {
        text: `
          SELECT user_id
          FROM rides_drivers
          WHERE tenant_id = $1 AND driver_id = $2
          LIMIT 1
        `,
        values: [tenantId, driver_id],
      }
    );

    if (!driverRow) {
      throw new NotFoundError('Driver not found');
    }

    const driverUserId = driverRow.user_id;

    // 2. Processar pagamento via Unify Bank
    const bankResult = await bankIntegrationService.processRidePayment(tenantId, {
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
    const { bankAccountService } = await import('../../bank/bank-account.service');
    const driverAccount = await bankAccountService.getAccountByOwner(tenantId, driverUserId, 'user', 'BRL');
    const feeAccount = await bankAccountService.getSystemAccount(tenantId, 'fee', 'BRL');

    const driverSplitAmount = bankResult.splits.find((s) => s.accountId === driverAccount?.accountId)?.amount || 0;
    const feeSplitAmount = bankResult.splits.find((s) => s.accountId === feeAccount?.accountId)?.amount || 0;

    const driverAmount = driverSplitAmount;
    const platformAmount = feeSplitAmount; // Fee vai para plataforma
    const communityAmount = 0; // Por enquanto, rides não têm community fund

    // 4. Gravar histórico no banco (compatibilidade)
    await this.recordDistribution(
      tenantId,
      ride_id,
      price,
      driverAmount,
      platformAmount,
      communityAmount
    );

    // 5. Armazenar bankTransactionId no ride (via metadata JSONB)
    await runQueryWithTenant(tenantId, {
      text: `
        UPDATE rides_rides
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('bankTransactionId', $3)
        WHERE tenant_id = $1 AND ride_id = $2
      `,
      values: [tenantId, ride_id, bankResult.transactionId],
    });

    // 6. Emitir evento de pagamento concluído
    await eventBus.emit({
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
  async getDistributionRule(tenantId: string, serviceTypeId: string) {
    return runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_distribution_rules
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
        values: [tenantId, serviceTypeId],
      }
    );
  }

  // ========================================================================
  // 🔹 3. Aplicar regra de distribuição
  // ========================================================================
  applyDistribution(totalCents: number, rule: any) {
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
  async recordDistribution(
    tenantId: string,
    rideId: string,
    price: any,
    driverAmount: number,
    platformAmount: number,
    communityAmount: number
  ) {
    await runQueryWithTenant(
      tenantId,
      {
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
      }
    );
  }

  // ========================================================================
  // 🔹 5. Transferir valores entre contas (DEPRECATED - usar SplitEngine)
  // ========================================================================
  // NOTA: Este método foi mantido para compatibilidade, mas não é mais usado
  // O SplitEngine agora gerencia todas as transferências automaticamente
  async transferFunds(
    tenantId: string,
    passengerAccount: any,
    driverAccount: any,
    platformAccount: any,
    communityFundAccount: any,
    driverAmount: number,
    platformAmount: number,
    communityAmount: number,
    rideId: string
  ) {
    // Método mantido para compatibilidade, mas não deve ser chamado
    // SplitEngine já gerencia todas as transferências
    console.warn('[DistributionService] transferFunds called but should use SplitEngine instead');
  }

  // ========================================================================
  // 🔹 6. Obter distribuição por rideId
  // ========================================================================
  async getByRideId(tenantId: string, rideId: string) {
    return runQueryWithTenant<any>(
      tenantId,
      {
        text: `
        SELECT *
        FROM rides_ride_distributions
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY calculatedAt DESC
        LIMIT 1
      `,
        values: [tenantId, rideId],
      }
    );
  }

  // ========================================================================
  // 🔹 7. Aplicar distribuição em uma corrida
  // ========================================================================
  async applyDistributionToRide(tenantId: string, rideId: string, options?: any) {
    // Buscar ride
    const ride = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
        SELECT *
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
        values: [tenantId, rideId],
      }
    );

    if (!ride) {
      throw new NotFoundError('Ride not found');
    }

    // Calcular preço (simplificado - pode ser melhorado)
    const price = {
      totalCents: ride.final_price || 0,
    };

    return this.processRidePayment(tenantId, ride, price);
  }
}

export const distributionService = new DistributionService();



