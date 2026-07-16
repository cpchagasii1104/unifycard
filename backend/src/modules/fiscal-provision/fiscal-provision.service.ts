// backend/src/modules/fiscal-provision/fiscal-provision.service.ts
// FISCAL 4D-1 (DECISION-0167) — MOTOR READ-ONLY DE PROVISÃO FISCAL · passada da PLATAFORMA.
//
// Fluxo (0167 §2→§4): TaxableEvent → perfil fiscal ATIVO da plataforma (casa 4b) → regras via
// resolver 4c-2 (ÚNICO ponto de resolução) → cálculo por regra (base × rate_bps, centavos inteiros,
// rounding_mode GOVERNADO da regra) → Σ tax_reserve → commission_distributable = gross − reserve →
// TaxProvisionResult[] + fiscal_snapshot SEM PII → trilha append-only idempotente.
//
// FRONTEIRAS DURAS (allowlist §3): o motor SÓ lê actor_fiscal_profiles/fiscal_identities (via
// repository 4b), tax_rules (via resolver 4c-2) e o próprio evento. NUNCA: bank_*, order/checkout,
// invoice, template fiscal, env, ACTOR_RESIDENCE do comprador, cidade textual, categoria/TREE.
// v1 NÃO move dinheiro, NÃO cria ledger, NÃO cria tax_reserve no Bank (4e), NÃO toca applies_to
// (4d-2). Infra-error PROPAGA — nunca vira fiscal_config_missing. Missing é HONESTO e DISCRIMINADO.

import type { PoolClient } from 'pg';
import { fiscalProfileRepository } from '@modules/fiscal/fiscal-profile.repository';
import { taxCatalogRepository } from '@modules/fiscal/tax-catalog.repository';
import { PLATFORM_REVENUE_STREAMS, ROUNDING_MODES, FISCAL_CONFIG_MISSING } from '@modules/fiscal/tax-catalog.types';
import type { RoundingMode, TaxRule } from '@modules/fiscal/tax-catalog.types';
import { fiscalProvisionLogRepository } from './fiscal-provision-log.repository';
import type { ProvisionLogRowInput } from './fiscal-provision-log.repository';
import {
  FISCAL_CALCULATION_VERSION,
  FISCAL_MISSING_REASONS,
} from './fiscal-provision.types';
import type {
  FiscalMissingReason,
  FiscalProvisionOutcome,
  FiscalSnapshot,
  PlatformCommissionTaxableEvent,
  TaxProvisionResult,
} from './fiscal-provision.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// limite seguro de aritmética inteira em Number: base × 10000 << 2^53
const MAX_SAFE_CENTS = 900_000_000_000_000; // 9e14 — 9 trilhões de reais em centavos

/**
 * Arredondamento GOVERNADO (0167 §8): divide numerator/10000 sob a política EXPRESSAMENTE
 * selecionada pela regra. Math.floor aqui é implementação interna da política — a ESCOLHA veio
 * de tax_rules.rounding_mode, nunca do motor.
 */
function dividePer10000(numerator: number, mode: RoundingMode): number {
  const q = Math.floor(numerator / 10000);
  const r = numerator - q * 10000;
  if (r === 0) return q;
  switch (mode) {
    case 'floor': return q;
    case 'ceil': return q + 1;
    case 'half_up': return r >= 5000 ? q + 1 : q;
    case 'half_even': {
      if (r > 5000) return q + 1;
      if (r < 5000) return q;
      return q % 2 === 0 ? q : q + 1; // empate exato → par
    }
  }
}

function missing(
  missingReason: FiscalMissingReason,
  reason: string,
  warnings: string[] = []
): Extract<FiscalProvisionOutcome, { status: 'fiscal_config_missing' }> {
  return { status: FISCAL_CONFIG_MISSING, missingReason, reason, results: [], taxReserveCents: null, commissionDistributableCents: null, warnings };
}

class FiscalProvisionService {
  /**
   * Calcula a provisão fiscal da COMISSÃO DA PLATAFORMA para um evento econômico canônico.
   * READ-ONLY sobre o mundo (a única escrita é a TRILHA append-only da própria decisão).
   * `consumptionMode='mandatory'` → fiscal_config_missing FALHA FECHADO (D9.6.18).
   */
  async provisionPlatformCommission(event: PlatformCommissionTaxableEvent, existingClient?: PoolClient): Promise<FiscalProvisionOutcome> {
    this.assertEventShape(event);
    const effectiveAt = event.effectiveAt ?? event.occurredAt;

    // ── contribuinte: perfil fiscal ATIVO da plataforma (casa 4b; regime SEMPRE do perfil) ──
    const profile = await fiscalProfileRepository.getActiveProfileForTenant(event.tenantId);
    if (!profile) {
      return this.finalize(event, effectiveAt, missing(
        'active_platform_fiscal_profile_missing',
        'Plataforma sem actor_fiscal_profile ATIVO e vigente no tenant — configure o perfil fiscal ' +
          '(casa 4b) antes de provisionar. O sistema não inventa regime (D9.2).'
      ), null, existingClient);
    }
    if (!profile.fiscalIdentityId) {
      return this.finalize(event, effectiveAt, missing(
        'fiscal_identity_missing',
        'Perfil fiscal ativo sem fiscal_identity canônica — incoerência de configuração.'
      ), profile, existingClient);
    }

    // ── regras: EXCLUSIVAMENTE o resolver 4c-2 (único ponto de resolução) ──
    const resolution = await taxCatalogRepository.resolveRuleOrMissing({
      tenantId: event.tenantId,
      taxpayerKind: 'platform',
      taxRegime: profile.taxRegime,
      countryId: event.countryId,
      stateId: event.stateId ?? null,
      cityId: event.cityId ?? null,
      conceptId: event.conceptId ?? null,
      platformRevenueStream: event.platformRevenueStream,
      onDate: effectiveAt,
    });
    if (resolution.status === FISCAL_CONFIG_MISSING) {
      return this.finalize(event, effectiveAt, missing('tax_rule_missing', resolution.reason), profile, existingClient);
    }

    // ── cálculo por regra (0167 §4): centavos inteiros; rounding da CONFIGURAÇÃO da regra ──
    const warnings: string[] = [];
    const results: TaxProvisionResult[] = [];
    for (const rule of resolution.rules) {
      if (rule.roundingMode == null || !ROUNDING_MODES.includes(rule.roundingMode)) {
        // Defensivo: activateRule já exige; regra ativa sem modo = configuração incoerente.
        return this.finalize(event, effectiveAt, missing(
          'rounding_mode_missing',
          `Regra ativa ${rule.id} v${rule.version} sem rounding_mode governado — configuração incoerente (0167 §8).`
        ), profile, existingClient);
      }
      const numerator = event.commissionGrossCents * rule.rateBps;
      const provisionCents = dividePer10000(numerator, rule.roundingMode);
      const ruleWarnings: string[] = [];
      if (rule.taxRegime == null) ruleWarnings.push(`generic_regime_rule_used:${rule.id}`);
      if (rule.rateBps === 0) ruleWarnings.push(`explicit_zero_rate:${rule.id}`);
      results.push({
        status: 'found',
        taxRuleId: rule.id,
        taxRuleVersion: rule.version,
        taxTypeId: rule.taxTypeId,
        taxpayerKind: 'platform',
        baseType: 'commission_gross',
        baseCents: event.commissionGrossCents,
        rateBps: rule.rateBps,
        roundingMode: rule.roundingMode,
        provisionCents,
        countryId: rule.countryId,
        stateId: rule.stateId,
        cityId: rule.cityId,
        source: rule.source,
        effectiveFrom: rule.effectiveFrom,
        effectiveUntil: rule.effectiveUntil,
        warnings: ruleWarnings,
      });
      warnings.push(...ruleWarnings);
    }

    // ── agregação (0167 §5/D7): soma de inteiros; SEM novo arredondamento; SEM clamp ──
    const taxReserveCents = results.reduce((acc, r) => acc + r.provisionCents, 0);
    const commissionDistributableCents = event.commissionGrossCents - taxReserveCents;
    if (taxReserveCents > event.commissionGrossCents) {
      warnings.push('tax_reserve_exceeds_commission_gross');
    }
    if (commissionDistributableCents < 0) {
      warnings.push('commission_distributable_negative');
    }

    const fiscalSnapshot: FiscalSnapshot = {
      calculationVersion: FISCAL_CALCULATION_VERSION,
      taxpayerKind: 'platform',
      fiscalIdentityId: profile.fiscalIdentityId,
      actorFiscalProfileId: profile.id,
      actorFiscalProfileVersion: profile.version,
      taxRegime: profile.taxRegime,
      platformRevenueStream: event.platformRevenueStream,
      conceptId: event.conceptId ?? null,
      countryId: event.countryId,
      stateId: event.stateId ?? null,
      cityId: event.cityId ?? null,
      occurredAt: event.occurredAt.toISOString(),
      effectiveAt: effectiveAt.toISOString(),
      baseType: 'commission_gross',
      commissionGrossCents: event.commissionGrossCents,
      taxReserveCents,
      commissionDistributableCents,
      rules: results.map((r) => ({
        taxRuleId: r.taxRuleId,
        taxRuleVersion: r.taxRuleVersion,
        taxTypeId: r.taxTypeId,
        rateBps: r.rateBps,
        roundingMode: r.roundingMode,
        provisionCents: r.provisionCents,
        source: r.source,
      })),
      warnings,
    };

    const outcome: FiscalProvisionOutcome = {
      status: 'found',
      results,
      taxReserveCents,
      commissionDistributableCents,
      warnings,
      fiscalSnapshot,
    };
    return this.finalize(event, effectiveAt, outcome, profile, existingClient);
  }

  /** Persiste a trilha (append-only, idempotente) e aplica o modo de consumo (0167 §7). */
  private async finalize(
    event: PlatformCommissionTaxableEvent,
    effectiveAt: Date,
    outcome: FiscalProvisionOutcome,
    profile: { id: string; version: number; taxRegime: string; fiscalIdentityId: string | null; actorId: string | null } | null,
    existingClient?: PoolClient
  ): Promise<FiscalProvisionOutcome> {
    const base: Omit<ProvisionLogRowInput, 'baseType' | 'baseCents' | 'taxRuleId' | 'taxRuleVersion' | 'taxTypeId' | 'rateBps' | 'roundingMode' | 'provisionCents' | 'status' | 'missingReason' | 'warnings' | 'fiscalSnapshot' | 'taxReserveCents' | 'commissionDistributableCents' | 'calculationVersion'> = {
      tenantId: event.tenantId,
      sourceModule: event.sourceModule,
      sourceReferenceId: event.sourceReferenceId,
      occurredAt: event.occurredAt,
      effectiveAt,
      taxpayerKind: 'platform',
      contributorActorId: profile?.actorId ?? null,
      fiscalIdentityId: profile?.fiscalIdentityId ?? null,
      actorFiscalProfileId: profile?.id ?? null,
      actorFiscalProfileVersion: profile?.version ?? null,
      taxRegime: profile?.taxRegime ?? null,
      platformRevenueStream: event.platformRevenueStream,
      conceptId: event.conceptId ?? null,
      countryId: event.countryId,
      stateId: event.stateId ?? null,
      cityId: event.cityId ?? null,
    };

    let rows: ProvisionLogRowInput[];
    if (outcome.status === 'found') {
      rows = outcome.results.map((r) => ({
        ...base,
        baseType: r.baseType,
        baseCents: r.baseCents,
        taxRuleId: r.taxRuleId,
        taxRuleVersion: r.taxRuleVersion,
        taxTypeId: r.taxTypeId,
        rateBps: r.rateBps,
        roundingMode: r.roundingMode,
        provisionCents: r.provisionCents,
        taxReserveCents: outcome.taxReserveCents,
        commissionDistributableCents: outcome.commissionDistributableCents,
        status: 'found',
        missingReason: null,
        warnings: r.warnings,
        calculationVersion: FISCAL_CALCULATION_VERSION,
        fiscalSnapshot: outcome.fiscalSnapshot,
      }));
    } else {
      rows = [{
        ...base,
        baseType: null,
        baseCents: null,
        taxRuleId: null,
        taxRuleVersion: null,
        taxTypeId: null,
        rateBps: null,
        roundingMode: null,
        provisionCents: null,
        taxReserveCents: null,
        commissionDistributableCents: null,
        status: 'fiscal_config_missing',
        missingReason: outcome.missingReason,
        warnings: outcome.warnings,
        calculationVersion: FISCAL_CALCULATION_VERSION,
        fiscalSnapshot: {
          calculationVersion: FISCAL_CALCULATION_VERSION,
          taxpayerKind: 'platform',
          missingReason: outcome.missingReason,
          reason: outcome.reason,
          platformRevenueStream: event.platformRevenueStream,
          countryId: event.countryId,
          stateId: event.stateId ?? null,
          cityId: event.cityId ?? null,
          occurredAt: event.occurredAt.toISOString(),
          effectiveAt: effectiveAt.toISOString(),
        },
      }];
    }

    const persisted = await fiscalProvisionLogRepository.appendRows(rows, existingClient);
    // Idempotência sem contradição: retry devolve a MESMA decisão; divergência = erro estrutural.
    for (let i = 0; i < persisted.length; i++) {
      const p = persisted[i]!;
      const r = rows[i]!;
      if (!p.inserted && (p.status !== r.status || p.provisionCents !== r.provisionCents)) {
        throw new Error(
          'FISCAL_PROVISION_LOG_CONTRADICTION: retry produziu decisão divergente da trilha ' +
            `(evento ${event.sourceModule}:${event.sourceReferenceId}, regra ${r.taxRuleId ?? 'missing'}) — investigar.`
        );
      }
    }

    if (outcome.status === FISCAL_CONFIG_MISSING && event.consumptionMode === 'mandatory') {
      // D9.6.18: contexto OBRIGATÓRIO falha fechado — a operação que depende de provisão NÃO fecha.
      const err = new Error(
        `FISCAL_CONFIG_MISSING_MANDATORY: ${outcome.missingReason} — contexto monetário obrigatório ` +
          'não fecha sem configuração fiscal governada (design D9.6.18, não bug).'
      ) as Error & { statusCode?: number; missingReason?: string };
      err.statusCode = 422;
      err.missingReason = outcome.missingReason;
      throw err;
    }
    return outcome;
  }

  /** Validação estrita do contrato do evento — fatos governados apenas; nada inferido. */
  private assertEventShape(event: PlatformCommissionTaxableEvent): void {
    if (event.contractVersion !== 1) throw new Error('TAXABLE_EVENT_CONTRACT_VERSION_UNSUPPORTED');
    if (event.taxpayerKind !== 'platform') {
      throw new Error('TAXABLE_EVENT_PASSADA_NOT_AUTHORIZED: esta fatia autoriza SÓ a passada da plataforma (0167 §6; seller/provider = fatia própria).');
    }
    if (!UUID_RE.test(event.tenantId)) throw new Error('TAXABLE_EVENT_TENANT_INVALID');
    if (!event.sourceModule?.trim() || !event.sourceReferenceId?.trim()) {
      throw new Error('TAXABLE_EVENT_IDENTITY_REQUIRED: source_module + source_reference_id são a identidade do evento (0167 §2).');
    }
    if (!PLATFORM_REVENUE_STREAMS.includes(event.platformRevenueStream)) {
      throw new Error(`REVENUE_STREAM_INVALID: '${event.platformRevenueStream}' fora do vocabulário governado.`);
    }
    if (!Number.isInteger(event.commissionGrossCents) || event.commissionGrossCents < 0 || event.commissionGrossCents > MAX_SAFE_CENTS) {
      throw new Error('TAXABLE_EVENT_COMMISSION_GROSS_INVALID: centavos inteiros >= 0 obrigatórios.');
    }
    if (!UUID_RE.test(event.countryId)) throw new Error('FISCAL_TERRITORY_INVALID: country_id canônico obrigatório (IDs, nunca texto).');
    if (event.stateId != null && !UUID_RE.test(event.stateId)) throw new Error('FISCAL_TERRITORY_INVALID: state_id não-canônico.');
    if (event.cityId != null && !UUID_RE.test(event.cityId)) throw new Error('FISCAL_TERRITORY_INVALID: city_id não-canônico.');
    if (event.cityId != null && event.stateId == null) throw new Error('FISCAL_TERRITORY_INVALID: city sem state (cadeia territorial incompleta).');
    if (event.conceptId != null && !UUID_RE.test(event.conceptId)) throw new Error('CONCEPT_INVALID: concept_id não-canônico.');
    if (!(event.occurredAt instanceof Date) || Number.isNaN(event.occurredAt.getTime())) throw new Error('TAXABLE_EVENT_TIME_INVALID');
    if (event.currency !== 'BRL') throw new Error('TAXABLE_EVENT_CURRENCY_UNSUPPORTED');
    if (event.consumptionMode !== 'informative' && event.consumptionMode !== 'mandatory') {
      throw new Error('TAXABLE_EVENT_CONSUMPTION_MODE_REQUIRED: declarar informative|mandatory (0167 §7).');
    }
  }
}

export const fiscalProvisionService = new FiscalProvisionService();
export { FISCAL_MISSING_REASONS };
