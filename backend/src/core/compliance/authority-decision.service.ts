/**
 * Orquestração única de precedência para mutações financeiras sensíveis:
 * 1) ATL / raiz de autoridade (SSOT, quando tabelas existem)
 * 2) KYC (identidade, quando aplicável)
 * 3) GUARDA (risco materializado + limites operacionais + tutela económica)
 *
 * Não duplica cálculo de score: delega a `evaluateActorRisk` e `checkActorPermissions`.
 */

import { runQueryWithTenant } from '@core/database/pool';
import { evaluateActorRisk } from '@modules/risk-identity/risk-engine.service';
import {
  checkActorPermissions,
  type FinancialRiskAction,
} from '@modules/risk-identity/risk-permissions';
import { getOrCreateProfile, type RiskLevel } from '@modules/risk-identity/actor-risk.repository';
import { getLimitsForRiskLevel } from '@modules/risk-identity/risk-limits.repository';
import { insertAuthorityDecisionAudit } from './authority-decision-audit.repository';
import type {
  AuthorityDecision,
  AuthorityDecisionSource,
  AuthorityFinancialEvaluation,
  AuthorityLayerTrace,
} from './authority-decision.types';
import { getAuthorityMode } from './authority-mode';

export interface FinancialSensitiveActionInput {
  actorId: string;
  action: FinancialRiskAction;
  amountCents?: number;
}

function isMissingRelation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '42P01';
}

async function evaluateAtlLayer(
  tenantId: string,
  actorId: string,
  layers: AuthorityLayerTrace[]
): Promise<{ block: boolean; reason: string; source: AuthorityDecisionSource } | null> {
  try {
    const root = await runQueryWithTenant<{ status: string }>(
      tenantId,
      `SELECT status FROM authority_roots WHERE actor_id = $1::uuid LIMIT 1`,
      [actorId]
    );
    if (!root) {
      if (getAuthorityMode() === 'strict') {
        layers.push({
          layer: 'ATL',
          outcome: 'block',
          reason: 'AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR:STRICT',
        });
        return { block: true, reason: 'AUTHORITY_ROOT_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({
        layer: 'ATL',
        outcome: 'skip',
        reason: 'AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR:PERMISSIVE',
      });
      return null;
    }
    if (root.status !== 'active') {
      layers.push({
        layer: 'ATL',
        outcome: 'block',
        reason: `AUTHORITY_ROOT_INACTIVE:${root.status}`,
      });
      return { block: true, reason: 'SSOT_ROOT_INACTIVE', source: 'rule' };
    }

    const atl = await runQueryWithTenant<{ atl_level: number }>(
      tenantId,
      `
      SELECT atl_level
      FROM authority_trust_levels
      WHERE actor_id = $1::uuid
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY effective_at DESC NULLS LAST
      LIMIT 1
      `,
      [actorId]
    );

    if (atl && atl.atl_level <= 0) {
      layers.push({
        layer: 'ATL',
        outcome: 'block',
        reason: `SSOT_ATL_BLOCKED:${atl.atl_level}`,
      });
      return { block: true, reason: 'SSOT_ATL_BLOCKED', source: 'rule' };
    }

    layers.push({
      layer: 'ATL',
      outcome: 'pass',
      reason: atl ? `ATL_OK:${atl.atl_level}` : 'ATL_ROW_ABSENT_TRUST_DEFAULT',
    });
    return null;
  } catch (e) {
    if (isMissingRelation(e)) {
      if (getAuthorityMode() === 'strict') {
        layers.push({
          layer: 'ATL',
          outcome: 'block',
          reason: 'ATL_SCHEMA_ABSENT:STRICT',
        });
        return { block: true, reason: 'ATL_SCHEMA_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({
        layer: 'ATL',
        outcome: 'skip',
        reason: 'ATL_SCHEMA_ABSENT:PERMISSIVE',
      });
      return null;
    }
    throw e;
  }
}

async function evaluateKycLayer(
  tenantId: string,
  actorId: string,
  layers: AuthorityLayerTrace[]
): Promise<{ block: boolean; reason: string; source: AuthorityDecisionSource } | null> {
  try {
    const row = await runQueryWithTenant<{
      actor_type: string;
      user_id: string | null;
      kyc_status: string | null;
    }>(
      tenantId,
      `
      SELECT
        a.actor_type::text AS actor_type,
        a.user_id,
        i.kyc_status::text AS kyc_status
      FROM actors a
      LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
      LEFT JOIN identities i ON i.global_user_id IS NOT DISTINCT FROM u.global_user_id
      WHERE a.tenant_id = $1 AND a.id = $2::uuid
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!row) {
      if (getAuthorityMode() === 'strict') {
        layers.push({ layer: 'KYC', outcome: 'block', reason: 'ACTOR_NOT_FOUND:STRICT' });
        return { block: true, reason: 'ACTOR_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({ layer: 'KYC', outcome: 'skip', reason: 'ACTOR_NOT_FOUND:PERMISSIVE' });
      return null;
    }

    const userLike = row.actor_type === 'user' || row.actor_type === 'person';
    if (!userLike || !row.user_id) {
      layers.push({
        layer: 'KYC',
        outcome: 'skip',
        reason: 'KYC_NOT_APPLICABLE_ACTOR_TYPE',
      });
      return null;
    }

    if (row.kyc_status == null) {
      if (getAuthorityMode() === 'strict') {
        layers.push({
          layer: 'KYC',
          outcome: 'block',
          reason: 'IDENTITY_NOT_LINKED:STRICT',
        });
        return { block: true, reason: 'IDENTITY_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({
        layer: 'KYC',
        outcome: 'skip',
        reason: 'IDENTITY_NOT_LINKED:PERMISSIVE',
      });
      return null;
    }

    if (row.kyc_status === 'rejected') {
      layers.push({ layer: 'KYC', outcome: 'block', reason: 'KYC_REJECTED' });
      return { block: true, reason: 'KYC_REJECTED', source: 'rule' };
    }

    if (row.kyc_status === 'pending') {
      layers.push({ layer: 'KYC', outcome: 'block', reason: 'KYC_PENDING' });
      return { block: true, reason: 'KYC_PENDING_BLOCKS_FINANCIAL', source: 'rule' };
    }

    layers.push({ layer: 'KYC', outcome: 'pass', reason: `KYC_OK:${row.kyc_status}` });
    return null;
  } catch (e) {
    if (isMissingRelation(e)) {
      if (getAuthorityMode() === 'strict') {
        layers.push({ layer: 'KYC', outcome: 'block', reason: 'KYC_SCHEMA_ABSENT:STRICT' });
        return { block: true, reason: 'KYC_SCHEMA_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({ layer: 'KYC', outcome: 'skip', reason: 'KYC_SCHEMA_ABSENT:PERMISSIVE' });
      return null;
    }
    throw e;
  }
}

/**
 * Camada KYB PJ (F2-C / DECISION-0088): bloqueia operação financeira sensível de page-actor/PJ quando
 * `fiscal_identities.kyb_status != 'approved'`. Aplica SOMENTE a actor_type='page' (KYC e KYB mutuamente
 * exclusivos por actor_type). Fonte: page-actor → company → companies.fiscal_identity_id →
 * fiscal_identities.kyb_status (NUNCA company_status/is_verified/identities). Fail-closed em qualquer elo
 * quebrado; STRICT para dinheiro de PJ (bloqueia mesmo em authority-mode permissive). NÃO toca Bank/KYC PF.
 */
async function evaluateKybLayer(
  tenantId: string,
  actorId: string,
  layers: AuthorityLayerTrace[]
): Promise<{ block: boolean; reason: string; source: AuthorityDecisionSource } | null> {
  try {
    const row = await runQueryWithTenant<{
      actor_type: string;
      company_id: string | null;
      fiscal_identity_id: string | null;
      kyb_status: string | null;
    }>(
      tenantId,
      `
      SELECT
        a.actor_type::text AS actor_type,
        a.company_id::text AS company_id,
        c.fiscal_identity_id::text AS fiscal_identity_id,
        fi.kyb_status::text AS kyb_status
      FROM actors a
      LEFT JOIN companies c ON c.company_id = a.company_id AND c.tenant_id = a.tenant_id
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE a.tenant_id = $1 AND a.id = $2::uuid
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!row) {
      // Actor não resolvido — KYC já tratou o mesmo actor; aqui espelha (strict block / permissive skip).
      if (getAuthorityMode() === 'strict') {
        layers.push({ layer: 'KYB', outcome: 'block', reason: 'ACTOR_NOT_FOUND:STRICT' });
        return { block: true, reason: 'ACTOR_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({ layer: 'KYB', outcome: 'skip', reason: 'ACTOR_NOT_FOUND:PERMISSIVE' });
      return null;
    }

    // KYB aplica SOMENTE a page-actor/PJ. user/person seguem por KYC (exclusivos por actor_type).
    if (row.actor_type !== 'page') {
      layers.push({ layer: 'KYB', outcome: 'skip', reason: 'KYB_NOT_APPLICABLE_ACTOR_TYPE' });
      return null;
    }

    // Page-actor/PJ em ação financeira sensível. STRICT para dinheiro (DECISION-0088 §3.6/§3.7):
    // fail-closed em qualquer elo quebrado e bloqueio se != approved — INDEPENDENTE do authority-mode.
    if (!row.company_id) {
      layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_COMPANY_LINK_MISSING' });
      return { block: true, reason: 'KYB_COMPANY_LINK_MISSING', source: 'rule' };
    }
    if (!row.fiscal_identity_id) {
      layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_FISCAL_IDENTITY_MISSING' });
      return { block: true, reason: 'KYB_FISCAL_IDENTITY_MISSING', source: 'rule' };
    }
    if (row.kyb_status == null) {
      layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_FISCAL_IDENTITY_MISSING' });
      return { block: true, reason: 'KYB_FISCAL_IDENTITY_MISSING', source: 'rule' };
    }
    if (row.kyb_status === 'approved') {
      layers.push({ layer: 'KYB', outcome: 'pass', reason: 'KYB_APPROVED' });
      return null;
    }
    if (row.kyb_status === 'rejected') {
      layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_REJECTED_BLOCKS_FINANCIAL' });
      return { block: true, reason: 'KYB_REJECTED_BLOCKS_FINANCIAL', source: 'rule' };
    }
    if (row.kyb_status === 'pending') {
      layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_PENDING_BLOCKS_FINANCIAL' });
      return { block: true, reason: 'KYB_PENDING_BLOCKS_FINANCIAL', source: 'rule' };
    }
    // suspended / closed / qualquer outro status != approved.
    layers.push({ layer: 'KYB', outcome: 'block', reason: `KYB_NOT_APPROVED_BLOCKS_FINANCIAL:${row.kyb_status}` });
    return { block: true, reason: 'KYB_NOT_APPROVED_BLOCKS_FINANCIAL', source: 'rule' };
  } catch (e) {
    if (isMissingRelation(e)) {
      // fiscal_identities/companies ausentes (ambiente sem F1/F2). Money de PJ → fail-closed em strict.
      if (getAuthorityMode() === 'strict') {
        layers.push({ layer: 'KYB', outcome: 'block', reason: 'KYB_SCHEMA_ABSENT:STRICT' });
        return { block: true, reason: 'KYB_SCHEMA_REQUIRED_STRICT_MODE', source: 'rule' };
      }
      layers.push({ layer: 'KYB', outcome: 'skip', reason: 'KYB_SCHEMA_ABSENT:PERMISSIVE' });
      return null;
    }
    throw e;
  }
}

async function evaluateEconomicGuardianship(
  tenantId: string,
  actorId: string,
  amountCents: number,
  layers: AuthorityLayerTrace[]
): Promise<{ block: boolean; reason: string } | null> {
  if (amountCents <= 0) return null;
  try {
    const g = await runQueryWithTenant<{ limit_amount_cents: string }>(
      tenantId,
      `
      SELECT limit_amount_cents::text AS limit_amount_cents
      FROM economic_guardianship
      WHERE subject_actor_id = $1::uuid
        AND expires_at > NOW()
      ORDER BY effective_at DESC NULLS LAST
      LIMIT 1
      `,
      [actorId]
    );
    if (!g) {
      layers.push({
        layer: 'GUARDA',
        outcome: 'skip',
        reason: 'NO_ACTIVE_GUARDIANSHIP',
      });
      return null;
    }
    const cap = Math.round(Number(g.limit_amount_cents));
    if (Number.isFinite(cap) && amountCents > cap) {
      layers.push({
        layer: 'GUARDA',
        outcome: 'block',
        reason: `ECONOMIC_GUARDIANSHIP_CAP:${cap}`,
      });
      return { block: true, reason: 'ECONOMIC_GUARDIANSHIP_LIMIT_EXCEEDED' };
    }
    layers.push({
      layer: 'GUARDA',
      outcome: 'pass',
      reason: 'GUARDIANSHIP_CAP_OK',
    });
    return null;
  } catch (e) {
    // isMissingRelation (42P01): tabela economic_guardianship ausente no schema.
    // EM PRODUÇÃO esta condição NUNCA deve ocorrer — tabela existe desde migration 20260501100000.
    // Este catch existe APENAS para ambientes de desenvolvimento sem migrations completas.
    // Se ocorrer em produção: é falha de infraestrutura grave — investigar imediatamente.
    // NÃO remover a tabela economic_guardianship. NÃO tratar ausência como "feature".
    // Ref: docs/01_normative/SSOT_REGISTRY_UNIFICARD.md §Guarda, docs/ssot/AUTHORITY_PRECEDENCE.md §4.3
    if (isMissingRelation(e)) {
      if (getAuthorityMode() === 'strict') {
        layers.push({
          layer: 'GUARDA',
          outcome: 'block',
          reason: 'GUARDIANSHIP_SCHEMA_ABSENT:STRICT',
        });
        return { block: true, reason: 'GUARDIANSHIP_SCHEMA_REQUIRED_STRICT_MODE' };
      }
      layers.push({
        layer: 'GUARDA',
        outcome: 'skip',
        reason: 'GUARDIANSHIP_SCHEMA_ABSENT:PERMISSIVE',
      });
      return null;
    }
    throw e;
  }
}

async function evaluateGuardaLayer(
  tenantId: string,
  input: FinancialSensitiveActionInput,
  layers: AuthorityLayerTrace[]
): Promise<{
  block: boolean;
  limit: boolean;
  reason: string;
  riskLevel: RiskLevel;
  requiresStepUp: boolean;
}> {
  await evaluateActorRisk(tenantId, input.actorId);

  const perm = await checkActorPermissions(tenantId, input.actorId, input.action);
  if (!perm.allowed) {
    layers.push({
      layer: 'GUARDA',
      outcome: 'block',
      reason: perm.reason || 'ACTOR_RISK_BLOCKED',
    });
    return {
      block: true,
      limit: false,
      reason: perm.reason || 'ACTOR_RISK_BLOCKED',
      riskLevel: perm.riskLevel,
      requiresStepUp: false,
    };
  }

  if (perm.requiresStepUp) {
    layers.push({
      layer: 'GUARDA',
      outcome: 'limit',
      reason: 'ACTOR_RISK_STEP_UP_REQUIRED',
    });
  }

  const profile = await getOrCreateProfile(tenantId, input.actorId);
  const level = profile.riskLevel;
  const limits = await getLimitsForRiskLevel(level);

  const amt = input.amountCents ?? 0;
  if (amt > 0) {
    let maxAllowed = Number.MAX_SAFE_INTEGER;
    switch (input.action) {
      case 'financial_transfer':
        maxAllowed = limits.maxTransferCentsPerOperation;
        break;
      case 'financial_payment':
        maxAllowed = limits.maxPaymentCentsPerOperation;
        break;
      case 'financial_payout':
        maxAllowed = limits.maxPayoutCentsPerOperation;
        break;
      default:
        break;
    }
    if (amt > maxAllowed) {
      layers.push({
        layer: 'GUARDA',
        outcome: 'block',
        reason: `ACTOR_RISK_LIMIT_EXCEEDED:${maxAllowed}`,
      });
      return {
        block: true,
        limit: false,
        reason: 'ACTOR_RISK_LIMIT_EXCEEDED',
        riskLevel: level,
        requiresStepUp: Boolean(perm.requiresStepUp),
      };
    }
  }

  const g = await evaluateEconomicGuardianship(tenantId, input.actorId, amt, layers);
  if (g?.block) {
    return {
      block: true,
      limit: false,
      reason: g.reason,
      riskLevel: level,
      requiresStepUp: Boolean(perm.requiresStepUp),
    };
  }

  if (!perm.requiresStepUp) {
    layers.push({
      layer: 'GUARDA',
      outcome: 'pass',
      reason: 'RISK_AND_LIMITS_OK',
    });
  }

  return {
    block: false,
    limit: Boolean(perm.requiresStepUp),
    reason: perm.requiresStepUp ? 'ACTOR_RISK_STEP_UP_REQUIRED' : 'GUARDA_CLEAR',
    riskLevel: level,
    requiresStepUp: Boolean(perm.requiresStepUp),
  };
}

function finalizeEvaluation(
  decision: AuthorityDecision,
  reason: string,
  source: AuthorityDecisionSource,
  confidence: number,
  requiresStepUp: boolean,
  riskLevel: RiskLevel | undefined,
  layers: AuthorityLayerTrace[]
): AuthorityFinancialEvaluation {
  if (decision !== 'block') {
    layers.push({ layer: 'REST', outcome: 'pass', reason: 'PRECEDENCE_COMPLETE' });
  }
  return {
    decision,
    reason,
    source,
    confidence,
    requiresStepUp,
    riskLevel,
    layers,
  };
}

async function persistAudit(
  tenantId: string,
  actorId: string,
  action: FinancialRiskAction,
  evaluation: AuthorityFinancialEvaluation
): Promise<void> {
  await insertAuthorityDecisionAudit({
    tenantId,
    actorId,
    actionType: action,
    decision: evaluation.decision,
    decisionSource: evaluation.source,
    confidence: evaluation.confidence,
    decisionReason: evaluation.reason,
    layerSummary: evaluation.layers,
  });
}

export const authorityDecisionService = {
  /**
   * Avaliação determinística com ordem fixa: ATL → KYC → GUARDA.
   */
  async evaluateFinancialSensitiveAction(
    tenantId: string,
    input: FinancialSensitiveActionInput
  ): Promise<AuthorityFinancialEvaluation> {
    const layers: AuthorityLayerTrace[] = [];

    const atl = await evaluateAtlLayer(tenantId, input.actorId, layers);
    if (atl?.block) {
      const ev = finalizeEvaluation('block', atl.reason, atl.source, 1, false, undefined, layers);
      await persistAudit(tenantId, input.actorId, input.action, ev);
      return ev;
    }

    const kyc = await evaluateKycLayer(tenantId, input.actorId, layers);
    if (kyc?.block) {
      const ev = finalizeEvaluation('block', kyc.reason, kyc.source, 1, false, undefined, layers);
      await persistAudit(tenantId, input.actorId, input.action, ev);
      return ev;
    }

    // F2-C / DECISION-0088: camada KYB PJ (ATL → KYC → KYB → GUARDA). Bloqueia money de page-actor/PJ
    // sem kyb_status='approved'. Mutuamente exclusiva do KYC por actor_type; strict para dinheiro.
    const kyb = await evaluateKybLayer(tenantId, input.actorId, layers);
    if (kyb?.block) {
      const ev = finalizeEvaluation('block', kyb.reason, kyb.source, 1, false, undefined, layers);
      await persistAudit(tenantId, input.actorId, input.action, ev);
      return ev;
    }

    const guarda = await evaluateGuardaLayer(tenantId, input, layers);
    if (guarda.block) {
      const ev = finalizeEvaluation(
        'block',
        guarda.reason,
        'rule',
        1,
        guarda.requiresStepUp,
        guarda.riskLevel,
        layers
      );
      await persistAudit(tenantId, input.actorId, input.action, ev);
      return ev;
    }

    if (guarda.limit) {
      const ev = finalizeEvaluation(
        'limit',
        guarda.reason,
        'rule',
        0.95,
        true,
        guarda.riskLevel,
        layers
      );
      await persistAudit(tenantId, input.actorId, input.action, ev);
      return ev;
    }

    const ev = finalizeEvaluation(
      'allow',
      'AUTHORITY_CHAIN_CLEAR',
      'rule',
      1,
      false,
      guarda.riskLevel,
      layers
    );
    await persistAudit(tenantId, input.actorId, input.action, ev);
    return ev;
  },

  /**
   * Falha apenas quando decisão final é `block` (compatível com rotas financeiras existentes).
   */
  assertFinancialSensitiveAllowed(evaluation: AuthorityFinancialEvaluation): void {
    if (evaluation.decision === 'block') {
      const err = new Error(evaluation.reason) as Error & {
        statusCode?: number;
        authorityEvaluation?: AuthorityFinancialEvaluation;
      };
      err.statusCode = 403;
      err.authorityEvaluation = evaluation;
      throw err;
    }
  },
};