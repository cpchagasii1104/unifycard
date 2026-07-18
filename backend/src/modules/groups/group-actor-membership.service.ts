// backend/src/modules/groups/group-actor-membership.service.ts
// D9.2-A (DECISION-0188) — service INTERNO e DORMENTE da membership Actor-first.
// ZERO caller de produto (nenhuma rota/controller/app.builder/job/consumer importa este módulo
// até o cutover D9.2-B). SEM alteração de comportamento vivo; group_members segue o legado.
//
// 🔒 FRONTEIRA TRANSACIONAL ÚNICA (padrão SELADO na remediação do D9.1): este service é o ÚNICO
//   transaction owner. Dentro de UMA transação, no MESMO client: tenant context LOCAL →
//   advisory lock por tenant+group (mesma chave das fns SQL — reentrante) → resolução do
//   principal via ensureUserActorTx (writer único §4.8.1) → canRepresentActor(…, client)
//   quando aplicável (evidência FOR SHARE — revogação concorrente serializa) → função canônica
//   SQL no MESMO client → readback → COMMIT. Falha ⇒ ROLLBACK integral; release único.
//
// IDs (DECISION-0131 B3 / 0188 D5): global_user_id = pessoa; user_id = conta no tenant;
//   actor_id = sujeito operacional. O service RESOLVE (nunca funde): principal → user-actor;
//   Actor institucional só com canRepresentActor. NUNCA: actor client-declarado como identidade,
//   global persistido como Actor, comparação user×actor, fallback entre namespaces.
// AUTHORITY: nenhuma capability/grant nova (D9.3 fechada). Role NUNCA é predicado.
// Membership NÃO é: ownership civil · binding (D9.1) · audience · category/N0/N1/N2 · conta.

import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import { ensureUserActorTx } from '@modules/identity/actor-writer.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { groupActorMembershipRepository } from './group-actor-membership.repository';
import type {
  AcceptMembershipIntentInput,
  CreateMembershipIntentInput,
  EnterMembershipAsRepresentativeInput,
  EnterMembershipSelfInput,
  GroupActorMembership,
  LeaveMembershipInput,
  RemoveMembershipInput,
} from './group-actor-membership.types';

class GroupActorMembershipService {
  /** TRANSACTION OWNER ÚNICO do D9.2-A (mesma disciplina selada do D9.1). */
  private async withAuthorityTransaction<T>(
    tenantId: string,
    groupId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
      // MESMA chave advisory das fns SQL (reentrante) — serializa por tenant+group ANTES da evidência
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || $1::text || ':' || $2::text, 0))`,
        [tenantId, groupId]
      );
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // conexão possivelmente inutilizada — release abaixo devolve/destrói
      }
      throw e;
    } finally {
      client.release();
    }
  }

  private assertInputs(tenantId: string, actingUserId: string): void {
    if (!tenantId?.trim() || !actingUserId?.trim()) {
      throw new BadRequestError('GAM_INPUT_NULL: tenant e principal autenticado sao obrigatorios (server-side).');
    }
  }

  /** Representação provada no MESMO client (fail-closed; infra-error PROPAGA — nunca vira false). */
  private async assertRepresents(
    client: PoolClient,
    tenantId: string,
    actingUserId: string,
    targetActorId: string,
    marker: string
  ): Promise<void> {
    const represents = await authorizationService.canRepresentActor(tenantId, actingUserId, targetActorId, client);
    if (!represents) {
      throw HttpError.forbidden(`${marker}: principal nao representa o actor ${targetActorId}.`);
    }
  }

  private async resolveGroupActorOnClient(client: PoolClient, tenantId: string, groupId: string): Promise<string> {
    const res = await client.query(
      `SELECT actor_id::text AS actor_id FROM groups WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
      [tenantId, groupId]
    );
    const actorId = (res.rows[0] as { actor_id: string | null } | undefined)?.actor_id;
    if (!actorId) {
      throw new NotFoundError('GAM_GROUP_NOT_FOUND: group inexistente ou sem group-actor no tenant.');
    }
    return actorId;
  }

  /** ENTRADA SELF (user-actor): o membro É o user-actor canônico do principal — nunca client-declared. */
  async enterMembershipSelf(input: EnterMembershipSelfInput): Promise<GroupActorMembership> {
    const { tenantId, actingUserId, groupId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!groupId?.trim() || !idempotencyKey?.trim()) {
      throw new BadRequestError('GAM_INPUT_NULL: groupId e idempotencyKey obrigatorios.');
    }
    return this.withAuthorityTransaction(tenantId, groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      // self: member = o PRÓPRIO user-actor resolvido server-side (sem canRepresentActor extra)
      const membershipId = await groupActorMembershipRepository.enter(
        client, tenantId, groupId, actingActor.actor_id, actingActor.actor_id, idempotencyKey
      );
      const membership = await groupActorMembershipRepository.findById(tenantId, membershipId, client);
      if (!membership) throw new Error('GAM_WRITER_NO_RESULT: membership nao encontrada na releitura transacional.');
      return membership;
    });
  }

  /** ENTRADA REPRESENTADA (page formal | group-raiz): exige canRepresentActor(member) no MESMO client. */
  async enterMembershipAsRepresentative(input: EnterMembershipAsRepresentativeInput): Promise<GroupActorMembership> {
    const { tenantId, actingUserId, groupId, memberActorId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!groupId?.trim() || !memberActorId?.trim() || !idempotencyKey?.trim()) {
      throw new BadRequestError('GAM_INPUT_NULL: groupId, memberActorId e idempotencyKey obrigatorios.');
    }
    return this.withAuthorityTransaction(tenantId, groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      await this.assertRepresents(client, tenantId, actingUserId, memberActorId, 'GAM_MEMBER_NOT_REPRESENTED');
      const membershipId = await groupActorMembershipRepository.enter(
        client, tenantId, groupId, memberActorId, actingActor.actor_id, idempotencyKey
      );
      const membership = await groupActorMembershipRepository.findById(tenantId, membershipId, client);
      if (!membership) throw new Error('GAM_WRITER_NO_RESULT: membership nao encontrada na releitura transacional.');
      return membership;
    });
  }

  /** SAÍDA VOLUNTÁRIA: self (user-actor do principal) OU representante válido do Actor membro. */
  async leaveMembership(input: LeaveMembershipInput): Promise<GroupActorMembership> {
    const { tenantId, actingUserId, membershipId } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!membershipId?.trim()) throw new BadRequestError('GAM_INPUT_NULL: membershipId obrigatorio.');

    const existing = await groupActorMembershipRepository.findById(tenantId, membershipId);
    if (!existing) throw new NotFoundError('GAM_MEMBERSHIP_NOT_FOUND: membership inexistente no tenant.');

    return this.withAuthorityTransaction(tenantId, existing.groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      if (actingActor.actor_id !== existing.memberActorId) {
        await this.assertRepresents(client, tenantId, actingUserId, existing.memberActorId, 'GAM_MEMBER_NOT_REPRESENTED');
      }
      const id = await groupActorMembershipRepository.leave(client, tenantId, membershipId, actingActor.actor_id);
      const membership = await groupActorMembershipRepository.findById(tenantId, id, client);
      if (!membership) throw new Error('GAM_WRITER_NO_RESULT: membership nao encontrada na releitura transacional.');
      return membership;
    });
  }

  /** REMOÇÃO ADMINISTRATIVA: exige canRepresentActor(group-actor do Group) — nunca role. */
  async removeMembership(input: RemoveMembershipInput): Promise<GroupActorMembership> {
    const { tenantId, actingUserId, membershipId } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!membershipId?.trim()) throw new BadRequestError('GAM_INPUT_NULL: membershipId obrigatorio.');

    const existing = await groupActorMembershipRepository.findById(tenantId, membershipId);
    if (!existing) throw new NotFoundError('GAM_MEMBERSHIP_NOT_FOUND: membership inexistente no tenant.');

    return this.withAuthorityTransaction(tenantId, existing.groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      const groupActorId = await this.resolveGroupActorOnClient(client, tenantId, existing.groupId);
      await this.assertRepresents(client, tenantId, actingUserId, groupActorId, 'GAM_GROUP_NOT_REPRESENTED');
      const id = await groupActorMembershipRepository.remove(client, tenantId, membershipId, actingActor.actor_id);
      const membership = await groupActorMembershipRepository.findById(tenantId, id, client);
      if (!membership) throw new Error('GAM_WRITER_NO_RESULT: membership nao encontrada na releitura transacional.');
      return membership;
    });
  }

  /**
   * INTENÇÃO EXPLÍCITA: invite (lado Group — canRepresentActor(group-actor)) ou
   * request (lado candidato — self ou canRepresentActor(candidate)). Direção SEMPRE declarada.
   */
  async createMembershipIntent(input: CreateMembershipIntentInput): Promise<string> {
    const { tenantId, actingUserId, groupId, candidateActorId, intentKind, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!groupId?.trim() || !candidateActorId?.trim() || !idempotencyKey?.trim()) {
      throw new BadRequestError('GAM_INPUT_NULL: groupId, candidateActorId e idempotencyKey obrigatorios.');
    }
    if (intentKind !== 'invite' && intentKind !== 'request') {
      throw new BadRequestError('GAM_INTENT_KIND_INVALID: intentKind deve ser invite|request (explicito).');
    }
    return this.withAuthorityTransaction(tenantId, groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      if (intentKind === 'invite') {
        const groupActorId = await this.resolveGroupActorOnClient(client, tenantId, groupId);
        await this.assertRepresents(client, tenantId, actingUserId, groupActorId, 'GAM_GROUP_NOT_REPRESENTED');
      } else if (actingActor.actor_id !== candidateActorId) {
        await this.assertRepresents(client, tenantId, actingUserId, candidateActorId, 'GAM_MEMBER_NOT_REPRESENTED');
      }
      return groupActorMembershipRepository.createIntent(
        client, tenantId, groupId, candidateActorId, actingActor.actor_id, intentKind, idempotencyKey
      );
    });
  }

  /**
   * ACEITE ATÔMICO: invite → lado candidato aceita (self ou canRepresentActor(candidate));
   * request → lado Group aprova (canRepresentActor(group-actor)). Intent accepted + membership
   * nascem NA MESMA transação (fn canônica).
   */
  async acceptMembershipIntent(input: AcceptMembershipIntentInput): Promise<GroupActorMembership> {
    const { tenantId, actingUserId, intentId } = input;
    this.assertInputs(tenantId, actingUserId);
    if (!intentId?.trim()) throw new BadRequestError('GAM_INPUT_NULL: intentId obrigatorio.');

    const intent = await groupActorMembershipRepository.findIntent(tenantId, intentId);
    if (!intent) throw new NotFoundError('GAM_INTENT_NOT_FOUND: intencao do caminho novo inexistente no tenant.');

    return this.withAuthorityTransaction(tenantId, intent.groupId, async (client) => {
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      if (intent.intentKind === 'invite') {
        if (actingActor.actor_id !== intent.candidateActorId) {
          await this.assertRepresents(client, tenantId, actingUserId, intent.candidateActorId, 'GAM_MEMBER_NOT_REPRESENTED');
        }
      } else {
        const groupActorId = await this.resolveGroupActorOnClient(client, tenantId, intent.groupId);
        await this.assertRepresents(client, tenantId, actingUserId, groupActorId, 'GAM_GROUP_NOT_REPRESENTED');
      }
      const membershipId = await groupActorMembershipRepository.acceptIntent(client, tenantId, intentId, actingActor.actor_id);
      const membership = await groupActorMembershipRepository.findById(tenantId, membershipId, client);
      if (!membership) throw new Error('GAM_WRITER_NO_RESULT: membership do aceite nao encontrada na releitura transacional.');
      return membership;
    });
  }
}

export const groupActorMembershipService = new GroupActorMembershipService();
