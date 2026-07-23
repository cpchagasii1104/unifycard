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
//  • COLETIVO (provider = grupo-actor, actor_type='group'; banda=grupo-actor): mesma cadeia da PF, com o
//    mínimo civil satisfeito pela ÂNCORA CIVIL do grupo-actor (actors.responsible_actor_id → actor humano →
//    MESMO JOIN a global_users/identities) — DECISION-0147 Q2 estendida a coletivo via âncora civil
//    (GO Clayton 2026-07-23, arco fundação eventos).

import { runQueryWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { authorityDecisionService } from '@core/compliance/authority-decision.service';
import { isActorEffectivelyBlocked } from '../risk-identity/actor-effective-block';

export interface OfferingActivationEligibilityInput {
  tenantId: string;
  providerActorId: string;
  companyId: string | null; // derivado server-side (offering.company_id); presente = PJ
  conceptId: string; // resolvido do canonical (match EXATO)
}

/** Resultado READ-ONLY: ok + reasons (códigos OFFERING_ACTIVATION_* na ordem dos checks). */
export interface OfferingActivationEligibility {
  ok: boolean;
  reasons: string[];
}

/**
 * 🔴 PREDICADO ÚNICO de elegibilidade de ativação (READ-ONLY, NÃO lança). FONTE COMPARTILHADA:
 *   • assertOfferingActivationEligibility (P3 gate) consome e dá throw (reasons[0]);
 *   • company-readiness projection (F-COMPANY-READINESS-PROJECTION) consome e devolve boolean/reasons.
 * NÃO existe segunda regra — UI e gate bebem da MESMA fonte (sem drift). Lê SSOT vivo; NUNCA
 * profile.metadata/inferência. Reasons na MESMA ordem dos checks (PJ: pub→operacional→kyb; PF:
 * declaração→civil→bloqueio) para preservar o erro lançado pelo gate (reasons[0]).
 */
export async function evaluateOfferingActivationEligibility(
  input: OfferingActivationEligibilityInput
): Promise<OfferingActivationEligibility> {
  const { tenantId, providerActorId, companyId, conceptId } = input;
  const reasons: string[] = [];

  // ── PJ ──────────────────────────────────────────────────────────────────────
  if (companyId) {
    const pub = await runQueryWithTenant<{ ok: number }>(
      tenantId,
      `SELECT 1 AS ok FROM company_concept_publications
        WHERE tenant_id = $1 AND company_id = $2 AND concept_id = $3 AND status = 'active' LIMIT 1`,
      [tenantId, companyId, conceptId]
    );
    if (!pub) {
      reasons.push('OFFERING_ACTIVATION_PUBLICATION_REQUIRED: ativar exige publicação ATIVA do concept pela empresa (DECISION-0147 Q3).');
    }
    const co = await runQueryWithTenant<{ primary_company_type_id: string | null }>(
      tenantId,
      `SELECT primary_company_type_id FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
      [companyId, tenantId]
    );
    if (!co || co.primary_company_type_id === null) {
      reasons.push('OFFERING_ACTIVATION_COMPANY_NOT_OPERATIONAL: empresa não operacional (primary_company_type ausente — DECISION-0100 D6 / 0147 Q2).');
    }
    const kyb = await authorityDecisionService.evaluatePageActorKybApproved(tenantId, providerActorId);
    if (!kyb.approved) {
      reasons.push(`OFFERING_ACTIVATION_KYB_REQUIRED: KYB não aprovado (${kyb.reason}) — ativação fail-closed (DECISION-0147 Q2).`);
    }
    return { ok: reasons.length === 0, reasons };
  }

  // ── PF (elegibilidade civil mínima / KYC-lite civil V1) ──────────────────────
  const decl = await runQueryWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok FROM actor_professional_concepts
      WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true LIMIT 1`,
    [tenantId, providerActorId, conceptId]
  );
  if (!decl) {
    reasons.push('OFFERING_ACTIVATION_DECLARATION_REQUIRED: ativar exige declaração profissional ATIVA do concept (DECISION-0147 Q2/Q3).');
  }
  // KYC-lite civil V1: derivável de SSOT civil vivo (sem metadata/inferência). birthdate FORA do V1.
  // Sujeito civil por TIPO de provider — fail-closed para qualquer tipo não coberto (civil = null):
  //  • 'user' (PF): o PRÓPRIO actor humano — JOIN global_users (CPF + nome civil) + identities (inalterado).
  //  • 'group' (COLETIVO — banda=grupo-actor): DECISION-0147 Q2 estendida a coletivo via ÂNCORA CIVIL
  //    (GO Clayton 2026-07-23, arco fundação eventos). O mínimo civil é satisfeito pela âncora humana
  //    `actors.responsible_actor_id` — invariante de nascimento do grupo-actor (findOrCreateGroupActor
  //    exige dono humano com global_user_id, §4.8.2) — com o MESMO JOIN a global_users (CPF + nome
  //    civil) + identities. Grupo-actor com responsible_actor_id NULL, ou âncora sem CPF/nome/identity
  //    → fail-closed (MESMO código OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED). O bloqueio efetivo
  //    (isActorEffectivelyBlocked, abaixo) JÁ cascateia grupo→âncora — não duplicado aqui.
  const provType = await runQueryWithTenant<{ actor_type: string }>(
    tenantId,
    `SELECT actor_type FROM actors WHERE id = $2 AND tenant_id = $1 LIMIT 1`,
    [tenantId, providerActorId]
  );
  let civil: { ok: number } | null = null;
  if (provType?.actor_type === 'user') {
    civil = await runQueryWithTenant<{ ok: number }>(
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
  } else if (provType?.actor_type === 'group') {
    civil = await runQueryWithTenant<{ ok: number }>(
      tenantId,
      `SELECT 1 AS ok
         FROM actors g
         JOIN actors anc ON anc.id = g.responsible_actor_id AND anc.tenant_id = g.tenant_id
         JOIN global_users gu ON gu.global_user_id = anc.global_user_id
         JOIN identities idt ON idt.global_user_id = anc.global_user_id
        WHERE g.id = $2 AND g.tenant_id = $1
          AND g.actor_type = 'group'
          AND g.responsible_actor_id IS NOT NULL
          AND anc.actor_type = 'user'
          AND anc.global_user_id IS NOT NULL
          AND gu.cpf IS NOT NULL
          AND gu.full_name IS NOT NULL
        LIMIT 1`,
      [tenantId, providerActorId]
    );
  }
  if (!civil) {
    reasons.push('OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED: elegibilidade civil mínima (KYC-lite civil V1) não satisfeita — PF: global_user vinculado com CPF + nome civil + identity; COLETIVO (grupo-actor): âncora civil responsible_actor_id humana com CPF + nome civil + identity (DECISION-0147 Q2 estendida a coletivo; birthdate fora do V1). Fail-closed.');
  }
  if (await isActorEffectivelyBlocked(tenantId, providerActorId)) {
    reasons.push('OFFERING_ACTIVATION_ACTOR_BLOCKED: provider bloqueado (atl_blocked_actors) — ativação fail-closed (DECISION-0147 Q2).');
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Revalida, NO momento da ativação, a elegibilidade para `service_offering.status = 'active'`.
 * Lança ForbiddenError (403) com code `OFFERING_ACTIVATION_*` se qualquer pré-condição não estiver viva.
 * DELEGA ao predicado único evaluateOfferingActivationEligibility (mesma fonte da readiness projection);
 * lança reasons[0] = o primeiro elo faltante (preserva comportamento/códigos do P3).
 */
export async function assertOfferingActivationEligibility(
  input: OfferingActivationEligibilityInput
): Promise<void> {
  const { ok, reasons } = await evaluateOfferingActivationEligibility(input);
  if (!ok) {
    throw new ForbiddenError(reasons[0]);
  }
}
