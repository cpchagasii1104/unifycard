// services-offering-activation-gate.ts
// 🔴 P3 / DECISION-0147 — GATE de ATIVAÇÃO segura de service_offering (draft→active / suspended→active).
//
// active = público/contratável com ELEGIBILIDADE VIVA revalidada NO MOMENTO da ativação (Q1). Lê SSOT vivo;
// NUNCA profile.metadata / localStorage / inferência por perfil. Somado a canRepresentActor (autoridade, já
// provado antes no caller). Qualquer elo faltando → FAIL-CLOSED (ForbiddenError).
//
//  • PJ (provider = page-actor de company; companyId setado): publicação ACTIVE do concept (0144/0147 Q3) +
//    KYB approved (fiscal_identities via authorityDecisionService.evaluatePageActorKybApproved) + empresa
//    OPERACIONAL (companies.primary_company_type_id, DECISION-0100 D6) (Q2).
//  • PF (provider = actor_type='user'): ELEGIBILIDADE CIVIL MÍNIMA PF / KYC-lite civil V1 (NÃO "KYC pleno"):
//    declaração profissional ACTIVE do concept (Q3) + global_user vinculado com CPF NOT NULL/UNIQUE +
//    full_name NOT NULL (runtime) + identities(global_user_id) vinculada + provider NÃO em atl_blocked_actors (Q2).
//    birthdate FORA do V1 (baixa materialidade). Se KYC-lite civil não for satisfeito → fail-closed (não inventar).

import { runQueryWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { authorityDecisionService } from '@core/compliance/authority-decision.service';
import { isActorEffectivelyBlocked } from '../risk-identity/actor-effective-block';

/**
 * Revalida, NO momento da ativação, a elegibilidade para `service_offering.status = 'active'`.
 * Lança ForbiddenError (403) com code `OFFERING_ACTIVATION_*` se qualquer pré-condição não estiver viva.
 */
export async function assertOfferingActivationEligibility(input: {
  tenantId: string;
  providerActorId: string;
  companyId: string | null; // derivado server-side (offering.company_id); presente = PJ
  conceptId: string; // resolvido do canonical (match EXATO)
}): Promise<void> {
  const { tenantId, providerActorId, companyId, conceptId } = input;

  // ── PJ ──────────────────────────────────────────────────────────────────────
  if (companyId) {
    const pub = await runQueryWithTenant<{ ok: number }>(
      tenantId,
      `SELECT 1 AS ok FROM company_concept_publications
        WHERE tenant_id = $1 AND company_id = $2 AND concept_id = $3 AND status = 'active' LIMIT 1`,
      [tenantId, companyId, conceptId]
    );
    if (!pub) {
      throw new ForbiddenError(
        'OFFERING_ACTIVATION_PUBLICATION_REQUIRED: ativar exige publicação ATIVA do concept pela empresa (DECISION-0147 Q3).'
      );
    }
    const co = await runQueryWithTenant<{ primary_company_type_id: string | null }>(
      tenantId,
      `SELECT primary_company_type_id FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
      [companyId, tenantId]
    );
    if (!co || co.primary_company_type_id === null) {
      throw new ForbiddenError(
        'OFFERING_ACTIVATION_COMPANY_NOT_OPERATIONAL: empresa não operacional (primary_company_type ausente — DECISION-0100 D6 / 0147 Q2).'
      );
    }
    const kyb = await authorityDecisionService.evaluatePageActorKybApproved(tenantId, providerActorId);
    if (!kyb.approved) {
      throw new ForbiddenError(
        `OFFERING_ACTIVATION_KYB_REQUIRED: KYB não aprovado (${kyb.reason}) — ativação fail-closed (DECISION-0147 Q2).`
      );
    }
    return;
  }

  // ── PF (elegibilidade civil mínima / KYC-lite civil V1) ──────────────────────
  const decl = await runQueryWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok FROM actor_professional_concepts
      WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true LIMIT 1`,
    [tenantId, providerActorId, conceptId]
  );
  if (!decl) {
    throw new ForbiddenError(
      'OFFERING_ACTIVATION_DECLARATION_REQUIRED: ativar exige declaração profissional ATIVA do concept (DECISION-0147 Q2/Q3).'
    );
  }
  // KYC-lite civil V1: derivável de SSOT civil vivo (sem metadata/inferência). birthdate FORA do V1.
  const civil = await runQueryWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok
       FROM actors a
       JOIN global_users gu ON gu.global_user_id = a.global_user_id
       JOIN identities idt ON idt.global_user_id = a.global_user_id
      WHERE a.id = $2 AND a.tenant_id = $1
        AND a.actor_type = 'user'
        AND a.global_user_id IS NOT NULL
        AND gu.cpf IS NOT NULL
        AND gu.full_name IS NOT NULL
      LIMIT 1`,
    [tenantId, providerActorId]
  );
  if (!civil) {
    throw new ForbiddenError(
      'OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED: elegibilidade civil mínima PF (KYC-lite civil V1) não satisfeita — exige global_user vinculado com CPF + nome civil + identity (DECISION-0147 Q2; birthdate fora do V1). Fail-closed.'
    );
  }
  if (await isActorEffectivelyBlocked(tenantId, providerActorId)) {
    throw new ForbiddenError(
      'OFFERING_ACTIVATION_ACTOR_BLOCKED: provider bloqueado (atl_blocked_actors) — ativação fail-closed (DECISION-0147 Q2).'
    );
  }
}
