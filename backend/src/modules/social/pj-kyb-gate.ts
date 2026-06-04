// src/modules/social/pj-kyb-gate.ts
// DECISION-0094 — Gate KYB na authority social de PJ (Fase Social Gate 1).
//
// Capability social PÚBLICA de page-actor/PJ (publish_feed, cast_vote) exige
// fiscal_identities.kyb_status='approved'. Este helper resolve a verificação
// SERVER-SIDE, fail-closed, espelhando a resolução do gate financeiro F2-C e do
// resolveKybApproved da reputation.service (3.0). NUNCA infere aprovação por
// company_status/is_verified/metadata/frontend/query-param.
//
// Escopo: page-actor/PJ apenas. PF/user/person e grupos NÃO são gateados por aqui
// (o caller checa actor_type='page' antes de chamar). Helper compartilhado com F2-C
// é higiene futura (Fase Social Gate 2), não pré-requisito.

import { runQueryWithTenant } from '@core/database/pool';

/**
 * Resolve se o page-actor/PJ está com KYB aprovado.
 * FONTE ÚNICA = fiscal_identities.kyb_status='approved' (page→company→fiscal_identity).
 * Fail-closed: company_id ausente / fiscal_identity ausente / kyb_status
 * pending|rejected|suspended|closed|null → `false`.
 */
export async function isPageActorKybApproved(tenantId: string, actorId: string): Promise<boolean> {
  const row = await runQueryWithTenant<{ kyb_status: string | null }>(
    tenantId,
    `SELECT fi.kyb_status::text AS kyb_status
       FROM actors a
       LEFT JOIN companies c ON c.company_id = a.company_id AND c.tenant_id = a.tenant_id
       LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE a.tenant_id = $1 AND a.id = $2::uuid
      LIMIT 1`,
    [tenantId, actorId]
  );
  return row?.kyb_status === 'approved';
}

/** Code/mensagem canônicos do bloqueio social por KYB (DECISION-0094). */
export const PJ_KYB_SOCIAL_BLOCK_CODE = 'PJ_KYB_REQUIRED_FOR_SOCIAL_ACTION';
export const PJ_KYB_SOCIAL_BLOCK_MESSAGE =
  'PJ_KYB_REQUIRED_FOR_SOCIAL_ACTION: Ação social pública de PJ exige KYB aprovado.';
