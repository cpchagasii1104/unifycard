// backend/src/modules/economy/metrics/economic-metrics.service.ts
//
// PE-4-METRICS-MVP (2026-05-26) — Métricas sociais REAIS para destinos
// econômicos (regional_fund, group). Read-only, sem migration, sem tabela
// nova, sem cache (MVP).
//
// Princípios (DECISIONs vinculadas):
//   - DECISION-0046: actor_wallet canônico.
//   - DECISION-0048: economic_policy_engine resolve; UnifyBank materializa.
//   - Saldo SEMPRE de bank_ledger (via bankAccountService.getBalance).
//   - Dedupe por identities.global_user_id segmentado por tax_id_type.
//   - actor NÃO é pessoa; actor_count fica APENAS em métricas internas.
//   - tax_id / cpf / cnpj NUNCA expostos no payload.
//   - "Ativo" = contribuiu nos últimos 30 dias via bank_splits.created_at
//     (K_metrics_2 = A).
//   - PF e PJ separados (K_metrics_3 = A); não-verificados em label
//     própria (K_metrics_5 = B).
//
// Inputs material:
//   - Conta Bank do destino:
//       regional_fund → bankAccountService.ensureRegionalFundBankAccountForRegion
//       group         → group_accounts.bank_account_id (FK bank_accounts)
//
// Saída pública (PublicEconomicMetrics) — segura por construção:
//   - balanceCents (ledger SSOT)
//   - pfVerifiedParticipants / pjVerifiedParticipants (histórico)
//   - pfActiveContributors30d / pjActiveContributors30d
//   - unverifiedContributors30d (label separada — nunca somar com PF/PJ)
//   - contributionVolume30dCents
//   - lastContributionAt (ISO ou null)
//
// Saída interna (InternalEconomicMetrics) — admin/audit only:
//   - actorCount30d (papéis operacionais, NÃO confundir com pessoas)
//   - uniqueGlobalUsers30d (total dedup cross PF/PJ/unverified)
//
// Nada escrito. Cache: opcional in-memory TTL 60s (fora desta fatia).

import { runQueryWithTenant } from '@core/database/pool';
import { bankAccountService } from '@modules/bank/bank-account.service';

export interface PublicEconomicMetrics {
  destinationType: 'regional_fund' | 'group';
  destinationId: string;
  bankAccountId: string;
  balanceCents: number;
  /** Pessoas físicas únicas verificadas que já contribuíram (histórico). */
  pfVerifiedParticipants: number;
  /** Empresas únicas verificadas que já contribuíram (histórico). */
  pjVerifiedParticipants: number;
  /** PF únicas verificadas com contribuição nos últimos 30 dias. */
  pfActiveContributors30d: number;
  /** PJ únicas verificadas com contribuição nos últimos 30 dias. */
  pjActiveContributors30d: number;
  /** Contribuidores nos últimos 30 dias SEM identity/KYC aprovado. */
  unverifiedContributors30d: number;
  /** Soma de amount_cents nos últimos 30 dias (todas as contribuições). */
  contributionVolume30dCents: number;
  /** ISO timestamp da última contribuição, ou null se nunca contribuiu. */
  lastContributionAt: string | null;
}

export interface InternalEconomicMetrics extends PublicEconomicMetrics {
  /** Quantos actors distintos (papéis operacionais) contribuíram em 30d.
   *  ATENÇÃO: actor != pessoa. Não usar em UI pública. */
  actorCount30d: number;
  /** Quantos global_user_id distintos (todos: PF+PJ+unverified). */
  uniqueGlobalUsers30d: number;
}

/**
 * Row bruta retornada pela query agregada — depois mapeada para o shape
 * público. Mantém amount_cents como string para evitar overflow JS.
 */
interface MetricsRow {
  balance_cents: string | null;
  pf_verified_participants: string;
  pj_verified_participants: string;
  pf_active_contributors_30d: string;
  pj_active_contributors_30d: string;
  unverified_contributors_30d: string;
  contribution_volume_30d_cents: string;
  last_contribution_at: Date | null;
  actor_count_30d: string;
  unique_global_users_30d: string;
}

/**
 * Query canônica de métricas a partir de uma bank_account de destino.
 *
 * Cadeia material:
 *   bank_splits.target_account_id = <accountId>
 *     → bank_splits.source_actor_id
 *       → actors.global_user_id
 *         → identities (tax_id_type, kyc_status)
 *
 * Dedupe correta:
 *   - DISTINCT global_user_id (NÃO actor.id) para contar pessoas/empresas.
 *   - tax_id_type='cpf' AND kyc_status='approved' → PF verificado.
 *   - tax_id_type='cnpj' AND kyc_status='approved' → PJ verificado.
 *   - global_user_id IS NULL OR kyc_status != 'approved' → unverified.
 */
const METRICS_SQL = `
WITH contribs AS (
  SELECT
    bs.source_actor_id,
    bs.amount_cents,
    bs.created_at,
    a.global_user_id,
    i.tax_id_type,
    i.kyc_status
  FROM bank_splits bs
  JOIN actors a ON a.id = bs.source_actor_id
  LEFT JOIN identities i ON i.global_user_id = a.global_user_id
  WHERE bs.tenant_id = $1::uuid
    AND bs.target_account_id = $2::uuid
)
SELECT
  COUNT(DISTINCT global_user_id)
    FILTER (WHERE tax_id_type = 'cpf'  AND kyc_status = 'approved')::text
    AS pf_verified_participants,
  COUNT(DISTINCT global_user_id)
    FILTER (WHERE tax_id_type = 'cnpj' AND kyc_status = 'approved')::text
    AS pj_verified_participants,
  COUNT(DISTINCT global_user_id)
    FILTER (WHERE tax_id_type = 'cpf'  AND kyc_status = 'approved'
                  AND created_at > NOW() - INTERVAL '30 days')::text
    AS pf_active_contributors_30d,
  COUNT(DISTINCT global_user_id)
    FILTER (WHERE tax_id_type = 'cnpj' AND kyc_status = 'approved'
                  AND created_at > NOW() - INTERVAL '30 days')::text
    AS pj_active_contributors_30d,
  COUNT(DISTINCT source_actor_id)
    FILTER (WHERE (global_user_id IS NULL OR kyc_status IS NULL OR kyc_status != 'approved')
                  AND created_at > NOW() - INTERVAL '30 days')::text
    AS unverified_contributors_30d,
  COALESCE(SUM(amount_cents) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0)::text
    AS contribution_volume_30d_cents,
  MAX(created_at) AS last_contribution_at,
  COUNT(DISTINCT source_actor_id)
    FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::text
    AS actor_count_30d,
  COUNT(DISTINCT global_user_id)
    FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::text
    AS unique_global_users_30d,
  NULL::text AS balance_cents
FROM contribs
`;

function parseIntSafe(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

class EconomicMetricsService {
  /**
   * Métricas públicas de um regional_fund.
   *
   * regionalFundId deve referenciar uma row em regional_funds(tenant_id, id).
   * A conta Bank correspondente é resolvida via
   * ensureRegionalFundBankAccountForRegion(tenantId, region) com a
   * (country, state, city) da row do fundo.
   *
   * Fail-closed se fundo não existe (RegionalFundNotFound).
   */
  async getRegionalFundMetrics(
    tenantId: string,
    regionalFundId: string
  ): Promise<PublicEconomicMetrics> {
    const fundRow = await runQueryWithTenant<{
      country: string;
      state: string;
      city: string;
    }>(
      tenantId,
      `SELECT country, state, city FROM regional_funds
        WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
      [tenantId, regionalFundId]
    );
    if (!fundRow) {
      throw new Error(
        `EconomicMetricsService: regional_fund ${regionalFundId} não encontrado no tenant ${tenantId}`
      );
    }
    const bankAcc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
      tenantId,
      { country: fundRow.country, state: fundRow.state, city: fundRow.city },
      'BRL'
    );
    return this.computeMetricsForAccount(tenantId, 'regional_fund', regionalFundId, bankAcc.accountId);
  }

  /**
   * Métricas públicas de um grupo.
   *
   * groupId deve referenciar groups(tenant_id, id). A conta Bank é resolvida
   * via group_accounts.bank_account_id (1:1 com group).
   *
   * Fail-closed se group_accounts.bank_account_id NULL (GroupBankAccountMissing) —
   * grupo precisa ter conta Bank dedicada para métricas financeiras.
   */
  async getGroupMetrics(
    tenantId: string,
    groupId: string
  ): Promise<PublicEconomicMetrics> {
    const accRow = await runQueryWithTenant<{ bank_account_id: string | null }>(
      tenantId,
      `SELECT bank_account_id FROM group_accounts
        WHERE tenant_id = $1::uuid AND group_id = $2::uuid LIMIT 1`,
      [tenantId, groupId]
    );
    if (!accRow || !accRow.bank_account_id) {
      throw new Error(
        `EconomicMetricsService: grupo ${groupId} sem group_accounts.bank_account_id — ` +
          'grupo precisa de conta Bank dedicada para métricas financeiras'
      );
    }
    return this.computeMetricsForAccount(tenantId, 'group', groupId, accRow.bank_account_id);
  }

  /**
   * Métricas com payload INTERNAL (admin/audit) — inclui actorCount30d.
   * Reservado para admin; payload público SEMPRE usa o shape sem actor_count.
   */
  async getRegionalFundMetricsInternal(
    tenantId: string,
    regionalFundId: string
  ): Promise<InternalEconomicMetrics> {
    const publicMetrics = await this.getRegionalFundMetrics(tenantId, regionalFundId);
    return this.augmentWithInternal(tenantId, publicMetrics);
  }

  async getGroupMetricsInternal(
    tenantId: string,
    groupId: string
  ): Promise<InternalEconomicMetrics> {
    const publicMetrics = await this.getGroupMetrics(tenantId, groupId);
    return this.augmentWithInternal(tenantId, publicMetrics);
  }

  private async computeMetricsForAccount(
    tenantId: string,
    destinationType: 'regional_fund' | 'group',
    destinationId: string,
    bankAccountId: string
  ): Promise<PublicEconomicMetrics> {
    const balance = await bankAccountService.getBalance(tenantId, bankAccountId);
    const row = await runQueryWithTenant<MetricsRow>(
      tenantId,
      METRICS_SQL,
      [tenantId, bankAccountId]
    );
    if (!row) {
      // Sem contribuição alguma — retorna métricas zeradas.
      return {
        destinationType,
        destinationId,
        bankAccountId,
        balanceCents: balance.balanceCents,
        pfVerifiedParticipants: 0,
        pjVerifiedParticipants: 0,
        pfActiveContributors30d: 0,
        pjActiveContributors30d: 0,
        unverifiedContributors30d: 0,
        contributionVolume30dCents: 0,
        lastContributionAt: null,
      };
    }
    return {
      destinationType,
      destinationId,
      bankAccountId,
      balanceCents: balance.balanceCents,
      pfVerifiedParticipants: parseIntSafe(row.pf_verified_participants),
      pjVerifiedParticipants: parseIntSafe(row.pj_verified_participants),
      pfActiveContributors30d: parseIntSafe(row.pf_active_contributors_30d),
      pjActiveContributors30d: parseIntSafe(row.pj_active_contributors_30d),
      unverifiedContributors30d: parseIntSafe(row.unverified_contributors_30d),
      contributionVolume30dCents: parseIntSafe(row.contribution_volume_30d_cents),
      lastContributionAt: row.last_contribution_at
        ? new Date(row.last_contribution_at).toISOString()
        : null,
    };
  }

  private async augmentWithInternal(
    tenantId: string,
    publicMetrics: PublicEconomicMetrics
  ): Promise<InternalEconomicMetrics> {
    const row = await runQueryWithTenant<MetricsRow>(
      tenantId,
      METRICS_SQL,
      [tenantId, publicMetrics.bankAccountId]
    );
    return {
      ...publicMetrics,
      actorCount30d: row ? parseIntSafe(row.actor_count_30d) : 0,
      uniqueGlobalUsers30d: row ? parseIntSafe(row.unique_global_users_30d) : 0,
    };
  }
}

export const economicMetricsService = new EconomicMetricsService();
