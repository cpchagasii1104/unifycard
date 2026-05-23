/**
 * Checklist: contas regional_fund → top-up reserve → rule → grant → consume (×2) → ledger.
 * Um único processo Node (mesmo singleton marketplaceService) para estado em memória.
 *
 * Uso:
 *   USE_BANK_REGIONAL_FUND=true pnpm exec tsx src/scripts/e2e-incentive-bank-checklist.ts
 *
 * Se o consume falhar com `COVERAGE_EXCEEDED` (trigger em bank_ledger), em **dev** apenas:
 *   E2E_RELAX_BANK_COVERAGE=true pnpm exec tsx src/scripts/e2e-incentive-bank-checklist.ts
 *
 * E2E_RELAX_BANK_COVERAGE — DEV ONLY; proibido em production e staging (loadBackendEnv fail-fast).
 */
import { loadBackendEnv } from '../core/db/load-backend-env';

loadBackendEnv();

process.env.USE_BANK_REGIONAL_FUND = 'true';

const TENANT =
  process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }

  const { pool } = await import('../core/database/pool');
  const { regionalFundService } = await import('../modules/marketplace/regional-fund.service');
  const { marketplaceService } = await import('../modules/marketplace/marketplace.service');

  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

    console.log('\n=== 1) bank_accounts (regional_fund, SP) ===\n');
    const accs = await c.query<{ id: string; owner_id: string }>(
      `SELECT id, owner_id FROM bank_accounts
       WHERE tenant_id = $1 AND owner_id LIKE '%regional_fund%' AND owner_id LIKE '%SP%'
       ORDER BY owner_id`,
      [TENANT]
    );
    console.log(JSON.stringify(accs.rows, null, 2));

    console.log('\n=== 2) regional_funds (tenant) ===\n');
    const funds = await c.query<{ id: string; country: string; state: string; city: string }>(
      `SELECT id, country, state, city FROM regional_funds WHERE tenant_id = $1 ORDER BY country, state, city`,
      [TENANT]
    );
    console.log(JSON.stringify(funds.rows, null, 2));

    const prefix = `system:regional_fund:${TENANT}:`;
    const accRow = accs.rows.find((a) => a.owner_id.startsWith(prefix));
    if (!accRow) {
      console.error('Nenhuma conta regional_fund com owner_id esperado; abort.');
      process.exit(1);
    }
    const regionKey = accRow.owner_id.slice(prefix.length);
    const rkParts = regionKey.split('-');
    if (rkParts.length < 3) {
      console.error(`owner_id regionKey inválido: ${regionKey}`);
      process.exit(1);
    }
    const region = {
      country: rkParts[0]!,
      state: rkParts[1]!,
      city: rkParts.slice(2).join('-'),
    };
    const fund = funds.rows.find(
      (r) => r.country === region.country && r.state === region.state && r.city === region.city
    );
    if (!fund) {
      console.error(
        `Sem linha em regional_funds para a região da conta Bank (${region.country}/${region.state}/${region.city}). Corrija duplicidade SaoPaulo vs SAO_PAULO.`
      );
      process.exit(1);
    }
    console.log('\n=== Região alinhada à conta Bank (SSOT) ===\n', region);

    console.log('\n=== 2b) Garantir snapshot + regra unlock_incentive (dev) ===\n');
    const { regionalImpactService } = await import('../modules/marketplace/regional-impact.service');
    const { regionalActivationRepository } = await import('../modules/marketplace/regional-activation.repository');
    const period = new Date().toISOString().slice(0, 7);
    await regionalImpactService.computeSnapshotFromData(TENANT, region, period, {
      totalVolumeCents: 10_000_000,
      totalTransactions: 500,
      regionalFundInflowCents: 0,
      regionalFundOutflowCents: 0,
    });
    await regionalActivationRepository.upsertRule(TENANT, {
      country: region.country,
      state: region.state,
      city: region.city,
      actionType: 'unlock_incentive',
      thresholdVolumeCents: null,
      thresholdTransactions: null,
      isActive: true,
    });
    console.log('Snapshot + regra OK (período ' + period + ')');

    console.log('\n=== 3) Funding (reserve → regional Bank) ===\n');
    const topupRef = `e2e-checklist-topup-${region.country}-${region.state}-${region.city}-v1`;
    /** Limite por transferência: {@link transferLimits.MAX_TRANSFER_CENTS} (= 5_000_000 centavos). */
    const topup = await regionalFundService.topUpRegionalFundBankFromReserve(
      TENANT,
      region,
      5_000_000,
      topupRef
    );
    console.log(JSON.stringify(topup, null, 2));

    console.log('\n=== 4) createIncentiveRule ===\n');
    const rule = await marketplaceService.orchestration.createIncentiveRule({
      tenantId: TENANT,
      region,
      incentiveType: 'delivery',
      maxAmountCents: 50_000,
      maxPerActor: 1_000_000,
      maxPerPeriod: 1_000_000,
      requiresTrustLevel: 'L2',
    });
    console.log('HTTP-equivalente: 201 Created', JSON.stringify({ ruleId: rule.ruleId, region: rule.region }, null, 2));

    console.log('\n=== 5) actor user com economic_identity (L2+ = trust_score_bps >= 3334) ===\n');
    const actors = await c.query<{ actor_id: string; trust_score_bps: number; user_id: string | null; actor_type: string }>(
      `SELECT ei.actor_id::text AS actor_id, ei.trust_score_bps, a.user_id::text AS user_id, a.actor_type
       FROM economic_identities ei
       INNER JOIN actors a ON a.tenant_id = ei.tenant_id AND a.id = ei.actor_id
       WHERE ei.tenant_id = $1::uuid
         AND ei.trust_score_bps >= 3334
         AND a.actor_type IN ('user', 'person', 'actor_human')
         AND a.user_id IS NOT NULL
         AND a.id IS DISTINCT FROM a.user_id
       ORDER BY a.actor_type, ei.actor_id
       LIMIT 5`,
      [TENANT]
    );
    console.log(JSON.stringify(actors.rows, null, 2));
    const actorId = actors.rows[0]?.actor_id;
    if (!actorId) {
      console.error('Sem economic_identities L2+; grant vai falhar.');
      process.exit(1);
    }

    console.log('\n=== 6) grantIncentive ===\n');
    const grant = await marketplaceService.orchestration.grantIncentive(TENANT, {
      ruleId: rule.ruleId,
      actorId,
      actorType: 'user',
      amountCents: 1000,
      reference: { order_id: 'e2e-order-checklist' },
    });
    console.log('HTTP-equivalente: 201 Created', JSON.stringify({ grantId: grant.grantId, amountCents: grant.amountCents }, null, 2));

    console.log('\n=== 6c) system_coverage (tenant) ===\n');
    const cov = await c.query<{ execution_capacity_cents: string; total_credits_cents: string }>(
      `SELECT execution_capacity_cents::text, total_credits_cents::text
       FROM system_coverage WHERE tenant_id = $1::uuid`,
      [TENANT]
    );
    console.log(cov.rows[0] ?? '(sem linha)');

    const relaxCoverage = process.env.E2E_RELAX_BANK_COVERAGE === 'true';
    if (relaxCoverage) {
      await c.query('ALTER TABLE bank_ledger DISABLE TRIGGER trg_check_coverage');
      console.warn(
        '⚠ E2E_RELAX_BANK_COVERAGE=true — trigger trg_check_coverage desativado só neste processo (DEV ONLY; proibido em production/staging).'
      );
    }

    console.log('\n=== 7) consume #1 ===\n');
    try {
      await marketplaceService.orchestration.consumeIncentive(TENANT, grant.grantId);
      console.log('HTTP-equivalente: 200 OK { message: incentivo consumido }');
    } finally {
      if (relaxCoverage) {
        await c.query('ALTER TABLE bank_ledger ENABLE TRIGGER trg_check_coverage');
      }
    }

    console.log('\n=== 8) consume #2 (esperado: erro de domínio — grant já consumido) ===\n');
    try {
      await marketplaceService.orchestration.consumeIncentive(TENANT, grant.grantId);
      console.log('Inesperado: segundo consume passou');
    } catch (e) {
      console.log(
        'HTTP-equivalente: 400 Bad Request',
        e instanceof Error ? e.message : e
      );
    }

    const refNs = await import('../modules/marketplace/marketplace-regional-fund-bank.helpers');
    const { v5: uuidv5 } = await import('uuid');
    const incentiveRefId = uuidv5(grant.grantId, refNs.REGIONAL_INCENTIVE_REF_NAMESPACE);

    console.log('\n=== 9) bank_transactions (incentivo) ===\n');
    const tx = await c.query<{ id: string; reference_type: string; reference_id: string }>(
      `SELECT id, reference_type, reference_id FROM bank_transactions
       WHERE tenant_id = $1 AND reference_type = 'regional_fund_incentive' AND reference_id = $2`,
      [TENANT, incentiveRefId]
    );
    console.log(JSON.stringify(tx.rows, null, 2));
    const tid = tx.rows[0]?.id;
    if (!tid) {
      console.error('Transação de incentivo não encontrada.');
      process.exit(1);
    }

    console.log('\n=== 10) bank_ledger (2 linhas debit+credit) ===\n');
    const led = await c.query<{ transaction_id: string; direction: string; amount_cents: string; account_id: string }>(
      `SELECT transaction_id, direction, amount_cents::text, account_id
       FROM bank_ledger WHERE tenant_id = $1 AND transaction_id = $2 ORDER BY direction`,
      [TENANT, tid]
    );
    console.log(JSON.stringify(led.rows, null, 2));
    console.log(`Linhas: ${led.rows.length} (esperado 2)`);
  } finally {
    c.release();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { pool } = await import('../core/database/pool');
    await pool.end();
  });