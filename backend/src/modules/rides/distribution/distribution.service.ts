// src/modules/rides/distribution/distribution.service.ts
// SPRINT 4: INTEGRATED WITH UNIFY BANK
//
/**
 * ⚠️ PROJEÇÃO FINANCEIRA — NÃO É SSOT (`rides_ride_distributions`)
 * Estes dados NÃO representam dinheiro real.
 * A verdade financeira está em:
 * - bank_ledger
 * - bank_transactions
 *
 * NÃO usar para:
 * - saldo
 * - reconciliação
 * - decisão financeira
 */

import { runQueryWithTenant, runTenantTransactionWithClient } from "@core/db";
import { BadRequestError, NotFoundError } from "@core/errors";
import { publishRideEventOutbox } from "../shared/publish-ride-event";
import { bankIntegrationService } from "../../bank/bank-integration.service";

export class DistributionService {

  // ========================================================================
  // 🔹 1. Processar pagamento final da corrida (INTEGRADO COM UNIFY BANK)
  // ========================================================================
  async processRidePayment(tenantId: string, ride: any, price: any) {
    const rideId = ride.ride_id ?? ride.id;
    const passengerUserId = ride.passenger_user_id;
    const driverId = ride.driver_id;
    const rideMetadata = ride.metadata ?? {};

    // 1. Buscar user_id do driver (driver_id é ID do driver, não userId)
    const driverRow = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      {
        text: `
          SELECT user_id
          FROM rides_drivers
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `,
        values: [tenantId, driverId],
      }
    );

    if (!driverRow) {
      throw new NotFoundError('Driver not found');
    }

    const driverUserId = driverRow.user_id;

    // 2. Processar pagamento via Unify Bank
    const totalCents = price.totalCents ?? price.total ?? 0;

    const bankResult = await bankIntegrationService.processRidePayment(tenantId, {
      rideId,
      passengerUserId,
      driverUserId: driverUserId,
      amountCents: totalCents,
      currency: 'BRL',
      idempotencyKey: `ride-${rideId}`,
      groupId: ride.group_id ?? rideMetadata.groupId,
      referrerUserId: ride.referrer_user_id ?? rideMetadata.referrerUserId,
      region: rideMetadata.region,
      metadata: {
        driverId,
        finalPrice: totalCents,
      },
    });

    // 3. Extrair valores dos splits para compatibilidade com registro histórico
    const { bankAccountService } = await import('../../bank/bank-account.service');
    const driverAccount = await bankAccountService.getAccountByOwner(tenantId, driverUserId, 'user', 'BRL');
    const feeAccount = await bankAccountService.getSystemAccount(tenantId, 'fee', 'BRL');

    const driverSplitAmount = bankResult.splits.find((s) => s.accountId === driverAccount?.accountId)?.amountCents || 0;
    const feeSplitAmount = bankResult.splits.find((s) => s.accountId === feeAccount?.accountId)?.amountCents || 0;
    const regionalFundAmount = bankResult.splits
      .filter((s) => s.splitType === 'regional_fund')
      .reduce((sum, split) => sum + split.amountCents, 0);
    const referralAmount = bankResult.splits
      .filter((s) => s.splitType === 'referral')
      .reduce((sum, split) => sum + split.amountCents, 0);
    const groupAmount = bankResult.splits
      .filter((s) => s.splitType === 'revenue_share' && s.accountId !== driverAccount?.accountId)
      .reduce((sum, split) => sum + split.amountCents, 0);

    const driverAmount = driverSplitAmount;
    const platformAmount = feeSplitAmount; // Fee vai para plataforma
    const communityAmount = 0; // Reserva para futuros fundos comunitários

    // 4–6. Gravar histórico + metadata + outbox (mesma transação)
    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
      INSERT INTO rides_ride_distributions (
        tenant_id, ride_id,
        total_amount_cents, driver_amount_cents,
        platform_amount_cents, community_amount_cents,
        regional_fund_amount_cents, group_amount_cents,
        referral_amount_cents, bank_transaction_id,
        calculated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
      ON CONFLICT (tenant_id, ride_id)
      DO UPDATE SET
        total_amount_cents = EXCLUDED.total_amount_cents,
        driver_amount_cents = EXCLUDED.driver_amount_cents,
        platform_amount_cents = EXCLUDED.platform_amount_cents,
        community_amount_cents = EXCLUDED.community_amount_cents,
        regional_fund_amount_cents = EXCLUDED.regional_fund_amount_cents,
        group_amount_cents = EXCLUDED.group_amount_cents,
        referral_amount_cents = EXCLUDED.referral_amount_cents,
        bank_transaction_id = EXCLUDED.bank_transaction_id,
        calculated_at = EXCLUDED.calculated_at
      `,
        [
          tenantId,
          rideId,
          totalCents,
          driverAmount,
          platformAmount,
          communityAmount,
          regionalFundAmount,
          groupAmount,
          referralAmount,
          bankResult.transactionId,
        ]
      );

      await client.query(
        `
        UPDATE rides_rides
        SET bank_transaction_id = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('bankTransactionId', $3)
        WHERE tenant_id = $1 AND id = $2
      `,
        [tenantId, rideId, bankResult.transactionId]
      );

      await publishRideEventOutbox(client, {
        type: "rides.payment.completed",
        tenantId,
        payload: {
          rideId,
          totalCents,
          projection: true,
          driverShareCentsEstimated: driverAmount,
          platformShareCentsEstimated: platformAmount,
          communityShareCentsEstimated: communityAmount,
          regionalFundShareCentsEstimated: regionalFundAmount,
          groupShareCentsEstimated: groupAmount,
          referralShareCentsEstimated: referralAmount,
          bankTransactionId: bankResult.transactionId,
        },
      });

      await publishRideEventOutbox(client, {
        type: "rides.ride.paid",
        tenantId,
        payload: {
          rideId,
        },
      });
    });

    return {
      ok: true,
      driverAmount,
      platformAmount,
      communityAmount,
      regionalFundAmount,
      groupAmount,
      referralAmount,
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
    const platformAmount = Math.round((totalCents * rule.platform_pct) / 100);
    const communityAmount = rule.community_fund_enabled
      ? Math.round((totalCents * rule.community_pct) / 100)
      : 0;
    const driverAmount = totalCents - platformAmount - communityAmount;

    if (platformAmount + driverAmount + communityAmount !== totalCents) {
      throw new Error(
        `SPLIT_INVARIANT_VIOLATED: platform(${platformAmount}) + driver(${driverAmount}) + community(${communityAmount}) !== total(${totalCents})`
      );
    }

    return {
      driverAmount,
      platformAmount,
      communityAmount,
    };
  }

  // ========================================================================
  // 🔹 4. Registrar distribuição no banco
  // ⚠️ `rides_ride_distributions`: projeção / histórico derivado — ver cabeçalho do ficheiro.
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
          price.totalCents ?? price.total ?? 0,
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
  // ⚠️ Leitura de `rides_ride_distributions`: não é prova financeira canónica.
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



