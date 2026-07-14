// F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 — CASA INTERNA DE APROVAÇÃO DO MANIFEST DE ALIASES (§6).
//
// Única forma autorizada de registrar manifest_approved. NÃO é rota pública. Recebe contexto autenticado
// SEMPRE server-side. Prova, ortogonalmente e obrigatoriamente:
//   (1) REPRESENTAÇÃO — canRepresentActor(tenant, operador, approver) — NUNCA engolida (erro de infra propaga;
//       só um `false` explícito nega). Não é capability.
//   (2) CAPABILITY — dentro da transação, via fn_register_alias_manifest_approval (que chama
//       fn_assert_territorial_capability: key EXATA territory:manage_neighborhood_aliases + Curitiba + grant travado).
// Não persiste execução nem alias. "status" nunca é autoridade. Job NÃO chama esta casa. Sem provider/CEP,
// sem fallback textual, sem Bank/Social, sem rota/frontend.

import { getClientWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';

/** Contexto autenticado — SEMPRE server-side. Nunca vem do body do cliente. */
export interface AliasManifestApprovalAuthContext {
  tenantId: string;
  operatorUserId: string;
}

export interface ApproveAliasManifestInput {
  /** Actor humano aprovador (representável pelo operador). Resolvido server-side, nunca do payload como autoridade. */
  approverActorId: string;
  /** Cidade do escopo (Curitiba no MVP). A capability é revalidada em DB contra este escopo. */
  cityId: string;
  manifestCode: string;
  manifestVersion: string;
  /** sha256 hex (64) do conteúdo estrutural do manifest. Aprovação vale só para ESTE hash. */
  manifestHash: string;
  lineCount: number;
  eventReason: string;
  evidence: string;
}

export interface ApproveAliasManifestResult {
  manifestApprovalEventId: string;
}

export class AliasManifestApprovalAuthorityError extends Error {}
export class AliasManifestApprovalValidationError extends Error {}

// Prova de REPRESENTAÇÃO — NUNCA engolida. Erro de infra propaga (não vira false/deny silencioso).
async function assertRepresentable(tenantId: string, operatorUserId: string, approverActorId: string): Promise<void> {
  const representable = await authorizationService.canRepresentActor(tenantId, operatorUserId, approverActorId);
  if (!representable) throw new AliasManifestApprovalAuthorityError('ALIAS_MANIFEST_APPROVER_NOT_REPRESENTABLE');
}

/**
 * Registra manifest_approved. Representação provada ANTES da transação; capability provada DENTRO dela
 * (fn_register_alias_manifest_approval). Atômico e fail-closed. NÃO cria execução nem alias.
 */
export async function approveAliasManifest(
  auth: AliasManifestApprovalAuthContext,
  input: ApproveAliasManifestInput,
): Promise<ApproveAliasManifestResult> {
  if (!auth.tenantId || !auth.operatorUserId) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_AUTH_CONTEXT_REQUIRED');
  if (!input.approverActorId) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_APPROVER_REQUIRED');
  if (!input.cityId) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_CITY_REQUIRED');
  if (!input.manifestCode || !input.manifestVersion) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_IDENTITY_REQUIRED');
  if (!/^[0-9a-f]{64}$/.test(input.manifestHash)) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_HASH_INVALID');
  if (!Number.isInteger(input.lineCount) || input.lineCount < 1) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_LINE_COUNT_INVALID');
  if (!input.eventReason?.trim() || !input.evidence?.trim()) throw new AliasManifestApprovalValidationError('ALIAS_MANIFEST_PROVENANCE_REQUIRED');

  // (1) REPRESENTAÇÃO server-side — antes da transação. Não engolida.
  await assertRepresentable(auth.tenantId, auth.operatorUserId, input.approverActorId);

  // (2) CAPABILITY em DB + registro atômico do manifest_approved.
  const client = await getClientWithTenant(auth.tenantId);
  try {
    await client.query('BEGIN');
    const res = await client.query<{ event_id: string }>(
      `SELECT public.fn_register_alias_manifest_approval($1,$2,$3,$4,$5,$6,$7,$8,$9) AS event_id`,
      [
        input.approverActorId,
        auth.operatorUserId,
        input.cityId,
        input.manifestCode,
        input.manifestVersion,
        input.manifestHash,
        input.lineCount,
        input.eventReason,
        input.evidence,
      ],
    );
    const eventId = res.rows[0]?.event_id;
    if (!eventId) throw new AliasManifestApprovalAuthorityError('ALIAS_MANIFEST_APPROVAL_NOT_REGISTERED');
    await client.query('COMMIT');
    return { manifestApprovalEventId: eventId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* já revertido */ }
    throw err;
  } finally {
    client.release();
  }
}
