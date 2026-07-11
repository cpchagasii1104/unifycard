// backend/src/modules/authority/actor-capability-grant.service.ts
// F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136). Service mínimo: grant / list / revoke + o primitivo
// de enforcement `hasCapabilityGrant` (DEFINIDO agora, NÃO aplicado a rota de negócio neste Slice).
//
// N2-D.2 (DECISION-0173): create/revoke passam pelas FUNÇÕES CANÔNICAS transacionais (repository), que
// exigem os cinco elos por operação (Actor representado · conta executora · Actor humano responsável ·
// key/grant usado · momento — DECISION-0171 §6.1-D). O Actor humano responsável é resolvido SERVER-SIDE
// via o mesmo padrão canônico já usado em toda a base (findByUserId — actors.user_id + actor_type='user'),
// NUNCA recebido do cliente.
//
// SEPARAÇÃO DE EIXOS (DECISION-0113/0134):
//   - REPRESENTAÇÃO: `canRepresentActor(user, actor)` = "este usuário pode vestir este actor?".
//   - CAPABILITY GRANT: `hasCapabilityGrant(actor, key, scope)` = "este actor recebeu a capability no escopo?".
//   - OWNER: o dono do recurso mantém autoridade NATIVA; o grant é ADITIVO para não-owner.
// O concedente precisa REPRESENTAR o `scopeActorId` (para page/company actor, canRepresentActor já exige
// canManageCompany). Nada confia em actorId client-declared — quem chama passa actorIds JÁ validados.

import { authorizationService } from '@core/authorization/authorization.service';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { runQueryWithTenant } from '@core/database/pool';
import { HttpError } from '@core/errors/http-error';
import { isActorEffectivelyBlocked } from '../risk-identity/actor-effective-block';
import { actorCapabilityGrantRepository } from './actor-capability-grant.repository';
import {
  ACTOR_SCOPED_CAPABILITY_KEYS,
  type ActorCapabilityGrant,
  type GrantCapabilityInput,
} from './actor-capability-grant.types';

function assertNonFinancialAllowlisted(capabilityKey: string): void {
  if (!(ACTOR_SCOPED_CAPABILITY_KEYS as readonly string[]).includes(capabilityKey)) {
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

/**
 * Resolve o Actor humano responsável pela CONTA executora, server-side, via o padrão canônico
 * findByUserId (actors.user_id = userId AND actor_type='user') — o mesmo usado por
 * companies.service/kyb-request-submit/catalog-governance/lifestyle etc. Nunca recebido do cliente.
 * Fail-closed: ausência de Actor humano para a conta é erro estrutural (403), não fallback silencioso.
 */
/**
 * N2-D.2-R2: validação ANTECIPADA (defesa do service, NÃO a única barreira — a função DB é a barreira
 * principal). Confirma que o Actor existe NO TENANT por consulta tenant-scoped; ausência (inexistente OU
 * de outro tenant) → erro de domínio fail-closed e NÃO-vazante (não distingue os dois casos, nem revela
 * nome/slug/tenant). Mesmo chamando fn_grant/fn_revoke direto como unificard_app, o cross-tenant continua
 * impossível pela função — esta checagem só melhora a mensagem de domínio.
 */
async function assertActorInTenant(tenantId: string, actorId: string, label: string): Promise<void> {
  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id::text AS id FROM actors WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
    [tenantId, actorId]
  );
  if (!row) {
    throw HttpError.notFound(`Actor de ${label} não encontrado no tenant.`);
  }
}

async function resolveResponsibleHumanActorId(tenantId: string, userId: string): Promise<string> {
  const humanActor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
  if (!humanActor) {
    throw HttpError.forbidden(
      'RESPONSIBLE_HUMAN_ACTOR_NOT_FOUND: conta autenticada sem Actor humano resolvível (actors.user_id) — ' +
        'operação de capability grant exige Actor humano responsável rastreável (DECISION-0171 §6.1-D).'
    );
  }
  return humanActor.actor_id;
}

export const actorCapabilityGrantService = {
  /**
   * Concede uma capability NÃO-financeira a um actor, escopada a outro actor. Fail-closed:
   *   - capability fora da allowlist actor-scoped → 403;
   *   - granteeActorId/scopeActorId ausentes → 403;
   *   - concedente NÃO representa o scopeActorId → 403 (autoridade do concedente sobre o escopo);
   *   - grava SEMPRE actor_id (grantee/scope/concedente), nunca slug/referral.
   * Create+evento granted são atômicos na função canônica (repository); os cinco elos (Actor
   * representado, conta executora, Actor humano responsável, grant/key usado, momento) são persistidos
   * no evento append-only. (Idempotência: UNIQUE parcial em (tenant,grantee,capability,scope) WHERE active.)
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

    // N2-D.2-R2: validação antecipada tenant-scoped do grantee (erro de domínio claro; a barreira dura
    // é a função DB fn_grant, que revalida grantee/scope/granted_by/executed_by/responsible_human ∈ tenant).
    await assertActorInTenant(tenantId, input.granteeActorId, 'grantee');

    // Actor humano responsável pela conta executora — resolvido server-side, nunca do cliente.
    const responsibleHumanActorId = await resolveResponsibleHumanActorId(tenantId, input.grantedByUserId);

    return actorCapabilityGrantRepository.insert(tenantId, {
      granteeActorId: input.granteeActorId,
      capabilityKey: input.capabilityKey,
      scopeActorId: input.scopeActorId,
      grantedByUserId: input.grantedByUserId,
      grantedByActorId: input.grantedByActorId,
      authoritySource: 'grant',
      validUntil: input.validUntil ?? null,
      reason: input.reason ?? null,
      executedByUserId: input.grantedByUserId,
      executedByActorId: input.grantedByActorId,
      responsibleHumanActorId,
      eventReason: input.eventReason,
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
   * reason da concessão NUNCA é alterado — revoke_reason é campo próprio, persistido pela função
   * canônica junto com o evento revoked (state+evento atômicos).
   */
  async revoke(
    tenantId: string,
    grantId: string,
    revoker: { userId: string; actorId: string },
    reason: string
  ): Promise<ActorCapabilityGrant> {
    const existing = await actorCapabilityGrantRepository.getById(tenantId, grantId);
    if (!existing) throw HttpError.notFound('Grant não encontrado');
    if (!existing.scopeActorId) throw HttpError.forbidden('Grant não é actor-scoped (rota apenas actor-only).');

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

    const responsibleHumanActorId = await resolveResponsibleHumanActorId(tenantId, revoker.userId);
    if (!reason || !reason.trim()) {
      throw HttpError.forbidden('revoke_reason é obrigatório (motivo próprio da revogação, nunca sobrescreve reason da concessão).');
    }

    const revoked = await actorCapabilityGrantRepository.revoke(
      tenantId,
      grantId,
      revoker.actorId,
      reason,
      revoker.userId,
      responsibleHumanActorId
    );
    if (!revoked) throw HttpError.forbidden('Grant não pôde ser revogado (já revogado/expirado/inexistente/não-actor-scoped?).');
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
