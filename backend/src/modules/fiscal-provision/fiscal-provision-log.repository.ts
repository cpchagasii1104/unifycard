// backend/src/modules/fiscal-provision/fiscal-provision-log.repository.ts
// FISCAL 4D-1 (DECISION-0167 §7.3) — persistência da TRILHA APPEND-ONLY da decisão fiscal.
//
// fiscal_provision_logs é classe LOG (SSOT_REGISTRY §V): trilha imutável do cálculo realizado —
// NÃO decide catálogo/policy/saldo; NÃO é fonte de regra; NÃO toca bank_*. UPDATE/DELETE são
// bloqueados por trigger no banco. Idempotência: UNIQUE por (evento, passada, regra) — retry do
// mesmo evento NÃO cria decisão divergente (ON CONFLICT + verificação de contradição no service).

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';
import type { FiscalMissingReason, FiscalSnapshot, TaxProvisionResult } from './fiscal-provision.types';

export interface ProvisionLogRowInput {
  tenantId: string;
  sourceModule: string;
  sourceReferenceId: string;
  occurredAt: Date;
  effectiveAt: Date;
  taxpayerKind: 'platform' | 'actor';
  contributorActorId: string | null;
  fiscalIdentityId: string | null;
  actorFiscalProfileId: string | null;
  actorFiscalProfileVersion: number | null;
  taxRegime: string | null;
  platformRevenueStream: string | null;
  conceptId: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  baseType: string | null;
  baseCents: number | null;
  taxRuleId: string | null;
  taxRuleVersion: number | null;
  taxTypeId: string | null;
  rateBps: number | null;
  roundingMode: string | null;
  provisionCents: number | null;
  taxReserveCents: number | null;
  commissionDistributableCents: number | null;
  status: 'found' | 'fiscal_config_missing' | 'not_applicable';
  missingReason: FiscalMissingReason | null;
  warnings: string[];
  calculationVersion: number;
  fiscalSnapshot: FiscalSnapshot | Record<string, unknown>;
}

export interface PersistedProvisionLog {
  id: string;
  taxRuleId: string | null;
  provisionCents: number | null;
  status: string;
  inserted: boolean;
}

const INSERT_SQL = `
  INSERT INTO fiscal_provision_logs
    (tenant_id, source_module, source_reference_id, occurred_at, effective_at,
     taxpayer_kind, contributor_actor_id, fiscal_identity_id, actor_fiscal_profile_id,
     actor_fiscal_profile_version, tax_regime, platform_revenue_stream, concept_id,
     country_id, state_id, city_id, base_type, base_cents, tax_rule_id, tax_rule_version,
     tax_type_id, rate_bps, rounding_mode, provision_cents, tax_reserve_cents,
     commission_distributable_cents, status, missing_reason, warnings, calculation_version,
     fiscal_snapshot)
  VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, $9::uuid, $10, $11, $12, $13::uuid,
          $14::uuid, $15::uuid, $16::uuid, $17, $18, $19::uuid, $20, $21::uuid, $22, $23, $24,
          $25, $26, $27, $28, $29::jsonb, $30, $31::jsonb)
  ON CONFLICT ON CONSTRAINT uq_fpl_event_rule DO NOTHING
  RETURNING id::text, tax_rule_id::text, provision_cents, status`;

const SELECT_EXISTING_SQL = `
  SELECT id::text, tax_rule_id::text, provision_cents, status
    FROM fiscal_provision_logs
   WHERE tenant_id = $1::uuid AND source_module = $2 AND source_reference_id = $3
     AND taxpayer_kind = $4
     AND platform_revenue_stream IS NOT DISTINCT FROM $5
     AND tax_rule_id IS NOT DISTINCT FROM $6::uuid
     AND tax_rule_version IS NOT DISTINCT FROM $7
   LIMIT 1`;

class FiscalProvisionLogRepository {
  /**
   * Persiste UMA linha da trilha em transação própria coerente. Idempotente: conflito na UNIQUE
   * devolve a decisão EXISTENTE (inserted=false) — o service compara e ABORTA em contradição
   * (nunca reescreve; a trilha é imutável por trigger).
   *
   * FISCAL-4E (DECISION-0179 D8): aceita `existingClient` OPCIONAL. Quando fornecido, os logs
   * participam da MESMA transação Bank do chamador — este método NÃO adquire client, NÃO executa
   * BEGIN/COMMIT/ROLLBACK e NÃO libera o client alheio (a camada dona controla a transação).
   * Sem `existingClient`, o comportamento legítimo atual (transação própria) é preservado.
   */
  async appendRows(rows: ProvisionLogRowInput[], existingClient?: PoolClient): Promise<PersistedProvisionLog[]> {
    if (rows.length === 0) return [];
    const tenantId = rows[0]!.tenantId;
    const ownsTx = existingClient == null;
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const out: PersistedProvisionLog[] = [];
    try {
      if (ownsTx) await client.query('BEGIN');
      for (const r of rows) {
        const params = [
          r.tenantId, r.sourceModule, r.sourceReferenceId, r.occurredAt, r.effectiveAt,
          r.taxpayerKind, r.contributorActorId, r.fiscalIdentityId, r.actorFiscalProfileId,
          r.actorFiscalProfileVersion, r.taxRegime, r.platformRevenueStream, r.conceptId,
          r.countryId, r.stateId, r.cityId, r.baseType, r.baseCents, r.taxRuleId, r.taxRuleVersion,
          r.taxTypeId, r.rateBps, r.roundingMode, r.provisionCents, r.taxReserveCents,
          r.commissionDistributableCents, r.status, r.missingReason,
          JSON.stringify(r.warnings), r.calculationVersion, JSON.stringify(r.fiscalSnapshot),
        ];
        const ins = await client.query<{ id: string; tax_rule_id: string | null; provision_cents: string | null; status: string }>(INSERT_SQL, params);
        if (ins.rows.length > 0) {
          const row = ins.rows[0]!;
          out.push({ id: row.id, taxRuleId: row.tax_rule_id, provisionCents: row.provision_cents == null ? null : Number(row.provision_cents), status: row.status, inserted: true });
        } else {
          const ex = await client.query<{ id: string; tax_rule_id: string | null; provision_cents: string | null; status: string }>(
            SELECT_EXISTING_SQL,
            [r.tenantId, r.sourceModule, r.sourceReferenceId, r.taxpayerKind, r.platformRevenueStream, r.taxRuleId, r.taxRuleVersion]
          );
          const row = ex.rows[0];
          if (!row) throw new Error('FISCAL_PROVISION_LOG_CONFLICT_UNRESOLVED: conflito de idempotência sem linha existente localizável.');
          out.push({ id: row.id, taxRuleId: row.tax_rule_id, provisionCents: row.provision_cents == null ? null : Number(row.provision_cents), status: row.status, inserted: false });
        }
      }
      if (ownsTx) await client.query('COMMIT');
      return out;
    } catch (e) {
      if (ownsTx) { try { await client.query('ROLLBACK'); } catch { /* noop */ } }
      throw e;
    } finally {
      if (ownsTx) client.release();
    }
  }
}

export const fiscalProvisionLogRepository = new FiscalProvisionLogRepository();
export type { TaxProvisionResult };
