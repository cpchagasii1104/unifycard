// backend/src/modules/authority/actor-capability-grant.service.ts
// F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136). Service mínimo: grant / list / revoke + o primitivo
// de enforcement `hasCapabilityGrant` (DEFINIDO agora, NÃO aplicado a rota de negócio neste Slice).
//
// SEPARAÇÃO DE EIXOS (DECISION-0113/0134):
//   - REPRESENTAÇÃO: `canRepresentActor(user, actor)` = "este usuário pode vestir este actor?".
//   - CAPABILITY GRANT: `hasCapabilityGrant(actor, key, scope)` = "este actor recebeu a capability no escopo?".
//   - OWNER: o dono do recurso mantém autoridade NATIVA; o grant é ADITIVO para não-owner.
// O concedente precisa REPRESENTAR o `scopeActorId` (para page/company actor, canRepresentActor já exige
// canManageCompany). Nada confia em actorId client-declared — quem chama passa actorIds JÁ validados.

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { isActorEffectivelyBlocked } from '../risk-identity/actor-effective-block';
import { actorCapabilityGrantRepository } from './actor-capability-grant.repository';
import {
  NON_FINANCIAL_CAPABILITY_ALLOWLIST,
  type ActorCapabilityGrant,
  type GrantCapabilityInput,
} from './actor-capability-grant.types';

function assertNonFinancialAllowlisted(capabilityKey: string): void {
  if (!(NON_FINANCIAL_CAPABILITY_ALLOWLIST as readonly string[]).includes(capabilityKey)) {
    throw HttpError.forbidden(
      `Capability '${capabilityKey}' não é concedível neste Slice (allowlist não-financeira MVP). ` +
        'Financeiro é CRITICAL e exige frente própria (3 paralelas).'
    );
  }
}

// 🔴 F-CAPABILITY-GRANT-QUARANTINE-GATE (§4.8.4) — representação ≠ autoridade-ativa. `canRepresentActor` prova que
// o concedente pode VESTIR o escopo; NÃO prova que a autoridade do escopo está ATIVA. Se o actor de escopo (ou sua
// âncora humana) está efetivamente bloqueado (atl_blocked_actors, via isActorEffectivelyBlocked — mesmo primitivo do
// offering-activation-gate), a autoridade está CONGELADA → não pode conceder/revogar capability. Fail-closed, ANTES
// de qualquer escrita. NÃO toca canRepresentActor (que segue puro).
async function assertScopeAuthorityNotQuarantined(tenantId: string, scopeActorId: string): Promise<void> {
  if (await isActorEffectivelyBlocked(tenantId, scopeActorId)) {
    throw HttpError.forbidden(
      'ACTOR_EFFECTIVELY_BLOCKED: actor de escopo em quarentena (ou âncora humana bloqueada) — ' +
        'autoridade congelada; não pode conceder/revogar capability (§4.8.4).'
    );
  }
}

export const actorCapabilityGrantService = {
  /**
   * Concede uma capability NÃO-financeira a um actor, escopada a outro actor. Fail-closed:
   *   - capability fora da allowlist → 403;
   *   - granteeActorId/scopeActorId ausentes → 403;
   *   - concedente NÃO representa o scopeActorId → 403 (autoridade do concedente sobre o escopo);
   *   - grava SEMPRE actor_id (grantee/scope/concedente), nunca slug/referral.
   * (Idempotência: UNIQUE parcial em (tenant,grantee,capability,scope) WHERE active — 2ª concessão idêntica falha.)
   */
  async grant(tenantId: string, input: GrantCapabilityInput): Promise<ActorCapabilityGrant> {
    assertNonFinancialAllowlisted(input.capabilityKey);
    if (!input.granteeActorId || !input.scopeActorId) {
      throw HttpError.forbidden('granteeActorId e scopeActorId são obrigatórios (actor_id, nunca slug).');
    }
    if (!input.grantedByUserId || !input.grantedByActorId) {
      throw HttpError.forbidden('Concedente (granted_by_user_id + granted_by_actor_id) obrigatório.');
    }

    // Autoridade do concedente sobre o ESCOPO: precisa representar o scope_actor server-side.
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, input.grantedByUserId, input.scopeActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      throw HttpError.forbidden(
        'Concedente sem autoridade sobre o escopo (scope_actor não representável) — DECISION-0113.'
      );
    }

    // 🔴 F-CAPABILITY-GRANT-QUARANTINE-GATE: autoridade do escopo congelada se bloqueado → 403 ANTES do INSERT.
    await assertScopeAuthorityNotQuarantined(tenantId, input.scopeActorId);

    return actorCapabilityGrantRepository.insert(tenantId, {
      granteeActorId: input.granteeActorId,
      capabilityKey: input.capabilityKey,
      scopeActorId: input.scopeActorId,
      grantedByUserId: input.grantedByUserId,
      grantedByActorId: input.grantedByActorId,
      authoritySource: 'grant',
      validUntil: input.validUntil ?? null,
      reason: input.reason ?? null,
    });
  },

  async list(
    tenantId: string,
    filters: { granteeActorId?: string; scopeActorId?: string; status?: string }
  ): Promise<ActorCapabilityGrant[]> {
    return actorCapabilityGrantRepository.list(tenantId, filters);
  },

  /**
   * Revoga um grant. O revogador precisa representar o scope_actor (mesma autoridade do concedente).
   */
  async revoke(
    tenantId: string,
    grantId: string,
    revoker: { userId: string; actorId: string },
    reason?: string | null
  ): Promise<ActorCapabilityGrant> {
    const existing = await actorCapabilityGrantRepository.getById(tenantId, grantId);
    if (!existing) throw HttpError.notFound('Grant não encontrado');

    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, revoker.userId, existing.scopeActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      throw HttpError.forbidden('Sem autoridade sobre o escopo do grant (scope_actor não representável).');
    }

    // 🔴 F-CAPABILITY-GRANT-QUARANTINE-GATE: autoridade do escopo congelada se bloqueado → 403 ANTES do revoke.
    await assertScopeAuthorityNotQuarantined(tenantId, existing.scopeActorId);

    const revoked = await actorCapabilityGrantRepository.revoke(tenantId, grantId, revoker.actorId, reason ?? null);
    if (!revoked) throw HttpError.forbidden('Grant não pôde ser revogado (já revogado/expirado?).');
    return revoked;
  },

  /**
   * 🔴 PRIMITIVO DE ENFORCEMENT (DEFINIDO agora; NÃO aplicado a nenhuma rota de negócio neste Slice).
   * Responde se `actorId` tem a capability ATIVA no escopo `scopeActorId`. Fail-closed (qualquer erro → false).
   * O enforcement real (compor com canRepresentActor + owner-nativo) é Slice futuro, gated por decisão de
   * produto (DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION).
   */
  async hasCapabilityGrant(
    tenantId: string,
    actorId: string,
    capabilityKey: string,
    scopeActorId: string
  ): Promise<boolean> {
    try {
      const g = await actorCapabilityGrantRepository.findActive(tenantId, actorId, capabilityKey, scopeActorId);
      return g !== null;
    } catch {
      return false;
    }
  },
};
