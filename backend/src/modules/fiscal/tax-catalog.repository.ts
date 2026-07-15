// backend/src/modules/fiscal/tax-catalog.repository.ts
// DECISION-0166 D9 — Fase 4c-2: leitor/escritor governado do CATÁLOGO FISCAL (tax_types / tax_rules).
//
// Rito de escrita = o MESMO da casa 4b / policy F1-a:
//   - tax_types nasce ativo (sem estado draft; identidade congelada, retire = active→retired).
//   - tax_rules nasce DRAFT → ativa (draft→active); ativa é IMUTÁVEL no banco (trigger); mudar
//     alíquota/vigência = NOVA VERSÃO. Ativar uma versão DEPRECIA a ativa anterior do MESMO ESCOPO.
//   - deprecated é terminal; DELETE de active/deprecated é bloqueado pelo banco.
// Resolução = LOCALIZA a regra aplicável; ausência = FISCAL_CONFIG_MISSING (D9.2). NÃO calcula
// imposto, NÃO multiplica rate_bps por dinheiro, NÃO cria tax_reserve — isso é a 4d (GO próprio).

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import {
  TAX_REGIMES,
  TAXPAYER_KINDS,
  PLATFORM_REVENUE_STREAMS,
  TAX_SCOPE_LEVELS,
  FISCAL_CONFIG_MISSING,
  ROUNDING_MODES,
} from './tax-catalog.types';
import type {
  TaxType,
  TaxRule,
  CreateTaxTypeInput,
  CreateTaxRuleInput,
  TaxRuleResolutionFilters,
  FiscalRuleResolution,
  TaxTypeStatus,
} from './tax-catalog.types';

interface TypeRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  scope_level: string;
  source: string | null;
  status: string;
  effective_from: Date;
  effective_until: Date | null;
  created_by_actor_id: string | null;
  created_at: Date;
}

interface RuleRow {
  id: string;
  tenant_id: string;
  tax_type_id: string;
  scope_level: string;
  taxpayer_kind: string;
  platform_revenue_stream: string | null;
  tax_regime: string | null;
  concept_id: string | null;
  country_id: string | null;
  state_id: string | null;
  city_id: string | null;
  rate_bps: number;
  rounding_mode: string | null;
  effective_from: Date;
  effective_until: Date | null;
  source: string;
  configured_by_actor_id: string | null;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

const TYPE_COLS = `id, tenant_id, code, name, description, scope_level, source, status,
       effective_from, effective_until, created_by_actor_id, created_at`;
const RULE_COLS = `id, tenant_id, tax_type_id, scope_level, taxpayer_kind, platform_revenue_stream,
       tax_regime, concept_id, country_id, state_id, city_id, rate_bps, rounding_mode, effective_from,
       effective_until, source, configured_by_actor_id, status, version, metadata, created_at`;

function toType(r: TypeRow): TaxType {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    code: r.code,
    name: r.name,
    description: r.description,
    scopeLevel: r.scope_level as TaxType['scopeLevel'],
    source: r.source,
    status: r.status as TaxType['status'],
    effectiveFrom: r.effective_from.toISOString(),
    effectiveUntil: r.effective_until ? r.effective_until.toISOString() : null,
    createdByActorId: r.created_by_actor_id,
    createdAt: r.created_at.toISOString(),
  };
}

function toRule(r: RuleRow): TaxRule {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    taxTypeId: r.tax_type_id,
    scopeLevel: r.scope_level as TaxRule['scopeLevel'],
    taxpayerKind: r.taxpayer_kind as TaxRule['taxpayerKind'],
    platformRevenueStream: r.platform_revenue_stream as TaxRule['platformRevenueStream'],
    taxRegime: r.tax_regime as TaxRule['taxRegime'],
    conceptId: r.concept_id,
    countryId: r.country_id,
    stateId: r.state_id,
    cityId: r.city_id,
    rateBps: r.rate_bps,
    roundingMode: r.rounding_mode as TaxRule['roundingMode'],
    effectiveFrom: r.effective_from.toISOString(),
    effectiveUntil: r.effective_until ? r.effective_until.toISOString() : null,
    source: r.source,
    configuredByActorId: r.configured_by_actor_id,
    status: r.status as TaxRule['status'],
    version: r.version,
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
  };
}

class TaxCatalogRepository {
  // ── tax_types ───────────────────────────────────────────────────────────────
  async createTaxType(input: CreateTaxTypeInput): Promise<TaxType> {
    if (!TAX_SCOPE_LEVELS.includes(input.scopeLevel)) {
      throw new Error(
        `TAX_SCOPE_LEVEL_INVALID: '${input.scopeLevel}' fora de (${TAX_SCOPE_LEVELS.join(', ')}).`
      );
    }
    const row = await runQueryWithTenant<TypeRow>(
      input.tenantId,
      `INSERT INTO tax_types
         (tenant_id, code, name, description, scope_level, source, created_by_actor_id, effective_from)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, COALESCE($8, NOW()))
       RETURNING ${TYPE_COLS}`,
      [
        input.tenantId,
        input.code,
        input.name,
        input.description ?? null,
        input.scopeLevel,
        input.source ?? null,
        input.createdByActorId ?? null,
        input.effectiveFrom ?? null,
      ]
    );
    if (!row) throw new Error('createTaxType: insert failed');
    return toType(row);
  }

  /** active → retired (transição única permitida pelo trigger). retired é terminal. */
  async retireTaxType(tenantId: string, taxTypeId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `UPDATE tax_types SET status = 'retired'
        WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'active'`,
      [tenantId, taxTypeId]
    );
  }

  async listTaxTypes(tenantId: string, opts?: { status?: TaxTypeStatus }): Promise<TaxType[]> {
    const rows = await runQueriesWithTenant<TypeRow>(
      tenantId,
      `SELECT ${TYPE_COLS} FROM tax_types
        WHERE tenant_id = $1::uuid
          AND ($2::text IS NULL OR status = $2::text)
        ORDER BY code ASC`,
      [tenantId, opts?.status ?? null]
    );
    return rows.map(toType);
  }

  // ── tax_rules ─────────────────────────────────────────────────────────────
  private assertRuleVocab(input: CreateTaxRuleInput): void {
    if (input.roundingMode != null && !ROUNDING_MODES.includes(input.roundingMode)) {
      throw new Error(
        `ROUNDING_MODE_INVALID: '${input.roundingMode}' fora do vocabulário governado (${ROUNDING_MODES.join(', ')}) — DECISION-0167 §8.`
      );
    }
    if (!TAXPAYER_KINDS.includes(input.taxpayerKind)) {
      throw new Error(
        `TAXPAYER_KIND_INVALID: '${input.taxpayerKind}' fora de (${TAXPAYER_KINDS.join(', ')}).`
      );
    }
    if (input.taxRegime != null && !TAX_REGIMES.includes(input.taxRegime)) {
      throw new Error(
        `TAX_REGIME_INVALID: '${input.taxRegime}' fora do vocabulário canônico (${TAX_REGIMES.join(', ')}) — D9.5.`
      );
    }
    if (
      input.platformRevenueStream != null &&
      !PLATFORM_REVENUE_STREAMS.includes(input.platformRevenueStream)
    ) {
      throw new Error(
        `PLATFORM_REVENUE_STREAM_INVALID: '${input.platformRevenueStream}' fora de (${PLATFORM_REVENUE_STREAMS.join(', ')}) — D9.5.`
      );
    }
    if (input.taxpayerKind === 'actor' && input.platformRevenueStream != null) {
      throw new Error(
        'PLATFORM_STREAM_ON_ACTOR: platform_revenue_stream só existe em regra de plataforma (D9.3).'
      );
    }
  }

  /** Cria DRAFT (rito: nada nasce ativo). Vocabulário validado no código antes do CHECK do banco. */
  async createDraftRule(input: CreateTaxRuleInput): Promise<TaxRule> {
    this.assertRuleVocab(input);
    const next = await runQueryWithTenant<{ v: number }>(
      input.tenantId,
      `SELECT COALESCE(MAX(version), 0) + 1 AS v
         FROM tax_rules
        WHERE tenant_id = $1::uuid
          AND tax_type_id = $2::uuid
          AND taxpayer_kind = $3
          AND platform_revenue_stream IS NOT DISTINCT FROM $4
          AND tax_regime IS NOT DISTINCT FROM $5
          AND concept_id IS NOT DISTINCT FROM $6::uuid
          AND country_id IS NOT DISTINCT FROM $7::uuid
          AND state_id IS NOT DISTINCT FROM $8::uuid
          AND city_id IS NOT DISTINCT FROM $9::uuid`,
      [
        input.tenantId,
        input.taxTypeId,
        input.taxpayerKind,
        input.platformRevenueStream ?? null,
        input.taxRegime ?? null,
        input.conceptId ?? null,
        input.countryId,
        input.stateId ?? null,
        input.cityId ?? null,
      ]
    );
    const row = await runQueryWithTenant<RuleRow>(
      input.tenantId,
      `INSERT INTO tax_rules
         (tenant_id, tax_type_id, scope_level, taxpayer_kind, platform_revenue_stream, tax_regime,
          concept_id, country_id, state_id, city_id, rate_bps, rounding_mode, effective_from, source,
          configured_by_actor_id, status, version, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::uuid, $9::uuid, $10::uuid, $11, $12,
               COALESCE($13, NOW()), $14, $15::uuid, 'draft', $16, $17::jsonb)
       RETURNING ${RULE_COLS}`,
      [
        input.tenantId,
        input.taxTypeId,
        input.scopeLevel,
        input.taxpayerKind,
        input.platformRevenueStream ?? null,
        input.taxRegime ?? null,
        input.conceptId ?? null,
        input.countryId,
        input.stateId ?? null,
        input.cityId ?? null,
        input.rateBps,
        input.roundingMode ?? null,
        input.effectiveFrom ?? null,
        input.source,
        input.configuredByActorId ?? null,
        next?.v ?? 1,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('createDraftRule: insert failed');
    return toRule(row);
  }

  /**
   * Ativa um DRAFT e DEPRECIA a ativa anterior do MESMO ESCOPO (uma ativa por escopo/vigência).
   * Transições permitidas pelo trigger: draft→active e active→deprecated. Atômico.
   */
  async activateRule(tenantId: string, ruleId: string): Promise<void> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const target = await client.query<RuleRow>(
        `SELECT ${RULE_COLS} FROM tax_rules
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'draft' LIMIT 1`,
        [tenantId, ruleId]
      );
      if (target.rows.length === 0) {
        throw new Error('TAX_RULE_NOT_DRAFT: só draft pode ser ativado (mudança = nova versão).');
      }
      const t = target.rows[0];
      // FISCAL 4D-1 (DECISION-0167 §8): regra ATIVA exige arredondamento GOVERNADO — draft pode
      // nascer incompleto, mas a ativação FALHA FECHADO sem rounding_mode. Zero default silencioso;
      // o motor nunca escolhe (Lei do Contador: arredondamento é dado da regra, não código).
      if (t.rounding_mode == null) {
        throw new Error(
          'TAX_RULE_ROUNDING_MODE_REQUIRED: ativação exige rounding_mode governado ' +
            `(${'half_up, half_even, floor, ceil'}) — DECISION-0167 §8; configure o draft antes de ativar.`
        );
      }
      await client.query(
        `UPDATE tax_rules SET status = 'deprecated', effective_until = COALESCE(effective_until, NOW())
          WHERE tenant_id = $1::uuid AND status = 'active'
            AND tax_type_id = $2::uuid
            AND taxpayer_kind = $3
            AND platform_revenue_stream IS NOT DISTINCT FROM $4
            AND tax_regime IS NOT DISTINCT FROM $5
            AND concept_id IS NOT DISTINCT FROM $6::uuid
            AND country_id IS NOT DISTINCT FROM $7::uuid
            AND state_id IS NOT DISTINCT FROM $8::uuid
            AND city_id IS NOT DISTINCT FROM $9::uuid`,
        [
          tenantId,
          t.tax_type_id,
          t.taxpayer_kind,
          t.platform_revenue_stream,
          t.tax_regime,
          t.concept_id,
          t.country_id,
          t.state_id,
          t.city_id,
        ]
      );
      await client.query(
        `UPDATE tax_rules SET status = 'active'
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'draft'`,
        [tenantId, ruleId]
      );
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* noop */ }
      throw e;
    } finally {
      client.release();
    }
  }

  /** active → deprecated (encerramento governado; terminal). */
  async deprecateRule(tenantId: string, ruleId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `UPDATE tax_rules SET status = 'deprecated', effective_until = COALESCE(effective_until, NOW())
        WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'active'`,
      [tenantId, ruleId]
    );
  }

  /**
   * LOCALIZA as regras fiscais ativas aplicáveis ao contexto (por tenant/taxpayer/regime/território/
   * concept/stream/vigência). Regra com dimensão NULL = "qualquer" naquela dimensão. Ordenado do mais
   * específico (city) ao mais amplo (country) — determinístico. NÃO calcula valor.
   */
  async resolveApplicableRules(filters: TaxRuleResolutionFilters): Promise<TaxRule[]> {
    const rows = await runQueriesWithTenant<RuleRow>(
      filters.tenantId,
      `SELECT ${RULE_COLS} FROM tax_rules
        WHERE tenant_id = $1::uuid
          AND status = 'active'
          AND taxpayer_kind = $2
          AND effective_from <= COALESCE($10::timestamptz, NOW())
          AND (effective_until IS NULL OR effective_until > COALESCE($10::timestamptz, NOW()))
          AND (tax_regime IS NULL OR tax_regime = $3)
          AND (concept_id IS NULL OR concept_id = $4::uuid)
          AND (platform_revenue_stream IS NULL OR platform_revenue_stream = $5)
          AND country_id = $6::uuid
          AND (state_id IS NULL OR state_id = $7::uuid)
          AND (city_id IS NULL OR city_id = $8::uuid)
          AND (scope_level <> 'state' OR $7::uuid IS NOT NULL)
          AND (scope_level <> 'city' OR $9::uuid IS NOT NULL)
        ORDER BY CASE scope_level WHEN 'city' THEN 0 WHEN 'state' THEN 1 ELSE 2 END,
                 version DESC`,
      [
        filters.tenantId,
        filters.taxpayerKind,
        filters.taxRegime ?? null,
        filters.conceptId ?? null,
        filters.platformRevenueStream ?? null,
        filters.countryId,
        filters.stateId ?? null,
        filters.cityId ?? null,
        filters.cityId ?? null,
        filters.onDate ?? null,
      ]
    );
    return rows.map(toRule);
  }

  /**
   * Contrato de leitura para o caller: `found` com as regras, OU `fiscal_config_missing` honesto
   * (D9.2) quando nenhuma regra governada existe — nunca alíquota inventada, nunca provisão.
   */
  async resolveRuleOrMissing(filters: TaxRuleResolutionFilters): Promise<FiscalRuleResolution> {
    const rules = await this.resolveApplicableRules(filters);
    if (rules.length === 0) {
      return {
        status: FISCAL_CONFIG_MISSING,
        rules: [],
        reason:
          'Nenhuma regra fiscal governada para o contexto (tenant/regime/território/tipo de receita). ' +
          'Configure em tax_rules — o sistema não inventa alíquota (D9.2).',
      };
    }
    return { status: 'found', rules };
  }
}

export const taxCatalogRepository = new TaxCatalogRepository();
