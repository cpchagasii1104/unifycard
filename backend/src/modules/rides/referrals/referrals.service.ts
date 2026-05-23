// src/modules/rides/referrals/referrals.service.ts

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { publishRideEventOutbox } from '../shared/publish-ride-event';
import { BadRequestError, NotFoundError } from '@core/errors';
import crypto from 'crypto';

export class ReferralsService {

  // ============================================================================
  // 🔹 1. Gerar código de indicação do motorista
  // ============================================================================
  async generateDriverReferralCode(
    tenantId: string,
    driverId: string
  ): Promise<string> {
    const existing = await runQueryWithTenant<{ referral_code: string | null }>(
      tenantId,
      {
        text: `
      SELECT referral_code
      FROM rides_drivers
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        values: [tenantId, driverId],
      }
    );

    if (existing?.referral_code) return existing.referral_code;

    const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    await runQueryWithTenant(
      tenantId,
      {
        text: `
      UPDATE rides_drivers
      SET referral_code = $3
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        values: [tenantId, driverId, newCode],
      }
    );

    return newCode;
  }

  // ============================================================================
  // 🔹 2. Aplicar código de indicação ao passageiro no cadastro
  // ============================================================================
  async applyReferralCode(tenantId: string, userId: string, promoCode: string) {
    const driver = await runQueryWithTenant<{ driver_id: string }>(
      tenantId,
      {
        text: `
      SELECT driver_id
      FROM rides_drivers
      WHERE tenant_id = $1
        AND UPPER(referral_code) = UPPER($2)
      `,
        values: [tenantId, promoCode],
      }
    );

    if (!driver) {
      throw new BadRequestError('Código de indicação inválido.');
    }

    // Inserir relação (quem indicou quem)
    await runQueryWithTenant(
      tenantId,
      {
        text: `
      INSERT INTO rides_referral_links (
        tenant_id, referred_user_id, referrer_driver_id, created_at
      )
      VALUES ($1,$2,$3, now())
      ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
      `,
        values: [tenantId, userId, driver.driver_id],
      }
    );

    return {
      ok: true,
      referrerDriverId: driver.driver_id,
    };
  }

  // ============================================================================
  // 🔹 3. Registrar bônus de indicação após corrida
  // ============================================================================
  async registerRideReferralBonus(
    tenantId: string,
    rideId: string,
    passengerId: string,
    totalAmount: number
  ) {
    // Procurar quem indicou esse passageiro
    const ref = await runQueryWithTenant<{ referrer_driver_id: string }>(
      tenantId,
      {
        text: `
      SELECT referrer_driver_id
      FROM rides_referral_links
      WHERE tenant_id = $1 AND referred_user_id = $2
      `,
        values: [tenantId, passengerId],
      }
    );

    if (!ref) return null; // Não há indicação -> nada a fazer

    // Buscar regras de distribuição
    const rules = await runQueryWithTenant<{ referral_pct: number | null }>(
      tenantId,
      {
        text: `
      SELECT referral_pct
      FROM rides_distribution_rules
      WHERE tenant_id = $1
      LIMIT 1
      `,
        values: [tenantId],
      }
    );

    if (!rules) return null;

    const pct = Number(rules.referral_pct || 0);
    if (pct <= 0) return null;

    const reward = totalAmount * pct;

    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
      INSERT INTO rides_referral_earnings (
        tenant_id, referrer_driver_id, ride_id, amount, created_at
      )
      VALUES ($1,$2,$3,$4, now())
      `,
        [tenantId, ref.referrer_driver_id, rideId, reward]
      );

      await publishRideEventOutbox(client, {
        type: 'rides.referral.reward',
        tenantId,
        payload: {
          driverId: ref.referrer_driver_id,
          reward,
          rideId,
        },
      });
    });

    return {
      referrerDriverId: ref.referrer_driver_id,
      reward,
    };
  }

  // ============================================================================
  // 🔹 4. Listar ganhos de referral de um motorista
  // ============================================================================
  async listDriverReferralEarnings(tenantId: string, driverId: string) {
    return runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_referral_earnings
      WHERE tenant_id = $1 AND referrer_driver_id = $2
      ORDER BY created_at DESC
      `,
        values: [tenantId, driverId],
      }
    );
  }

  // ============================================================================
  // 🔹 5. Contagem total de ganhos por indicação
  // ============================================================================
  async getDriverReferralSummary(tenantId: string, driverId: string) {
    return runQueryWithTenant<{ total_earnings: string; total_rides: string }>(
      tenantId,
      {
        text: `
      SELECT 
        COALESCE(SUM(amount), 0) AS total_earnings,
        COUNT(*) AS total_rides
      FROM rides_referral_earnings
      WHERE tenant_id = $1 AND referrer_driver_id = $2
      `,
        values: [tenantId, driverId],
      }
    );
  }
}

export const referralsService = new ReferralsService();

