// backend/src/modules/groups/group-actor-membership.repository.ts
// D9.2-A (DECISION-0188) — repository PRIVADO e DORMENTE da casa group_actor_memberships e do
// caminho NOVO de intenções em group_invites.
// ESCRITA: exclusivamente via funções canônicas SECURITY DEFINER, invocadas OBRIGATORIAMENTE no
// client transacional do service (transaction owner único) — o MESMO client onde a autoridade
// foi provada (padrão selado do D9.1). unificard_app NÃO tem DML direto na casa nova.
// Este repository NÃO abre conexão própria, NÃO faz BEGIN/COMMIT e NÃO possui caller de produto.
// LEITURA: no client (dentro da transação) ou pool tenant-scoped (read-model/testes).
// PROIBIDO aqui: user_id/global_user_id como identidade de membership · group_members (legado
// intocado) · category/N0/N1/N2 · role · Bank.

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { GroupActorMembership, GroupMembershipIntentKind } from './group-actor-membership.types';

interface MembershipRow {
  id: string;
  tenant_id: string;
  group_id: string;
  member_actor_id: string;
  status: string;
  entry_idempotency_key: string;
  created_by_actor_id: string;
  created_at: string;
  source_intent_id: string | null;
  left_by_actor_id: string | null;
  left_at: string | null;
  removed_by_actor_id: string | null;
  removed_at: string | null;
}

const SELECT_COLS = `
  id::text, tenant_id::text, group_id::text, member_actor_id::text, status,
  entry_idempotency_key, created_by_actor_id::text, created_at,
  source_intent_id::text, left_by_actor_id::text, left_at, removed_by_actor_id::text, removed_at
`;

function toMembership(r: MembershipRow): GroupActorMembership {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    groupId: r.group_id,
    memberActorId: r.member_actor_id,
    status: r.status as GroupActorMembership['status'],
    entryIdempotencyKey: r.entry_idempotency_key,
    createdByActorId: r.created_by_actor_id,
    createdAt: r.created_at,
    sourceIntentId: r.source_intent_id,
    leftByActorId: r.left_by_actor_id,
    leftAt: r.left_at,
    removedByActorId: r.removed_by_actor_id,
    removedAt: r.removed_at,
  };
}

class GroupActorMembershipRepository {
  /** Entrada via função canônica NO client transacional do caller (único caminho de INSERT). */
  async enter(
    client: PoolClient,
    tenantId: string,
    groupId: string,
    memberActorId: string,
    actingActorId: string,
    idempotencyKey: string,
    sourceIntentId: string | null = null
  ): Promise<string> {
    const res = await client.query(
      `SELECT fn_enter_group_actor_membership($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid) ::text AS membership_id`,
      [tenantId, groupId, memberActorId, actingActorId, idempotencyKey, sourceIntentId]
    );
    const id = (res.rows[0] as { membership_id: string } | undefined)?.membership_id;
    if (!id) throw new Error('GAM_WRITER_NO_RESULT: fn_enter_group_actor_membership nao retornou id.');
    return id;
  }

  /** Saída voluntária (terminal left) NO client transacional do caller. */
  async leave(client: PoolClient, tenantId: string, membershipId: string, actingActorId: string): Promise<string> {
    const res = await client.query(
      `SELECT fn_leave_group_actor_membership($1::uuid, $2::uuid, $3::uuid) ::text AS membership_id`,
      [tenantId, membershipId, actingActorId]
    );
    const id = (res.rows[0] as { membership_id: string } | undefined)?.membership_id;
    if (!id) throw new Error('GAM_WRITER_NO_RESULT: fn_leave_group_actor_membership nao retornou id.');
    return id;
  }

  /** Remoção administrativa (terminal removed) NO client transacional do caller. */
  async remove(client: PoolClient, tenantId: string, membershipId: string, actingActorId: string): Promise<string> {
    const res = await client.query(
      `SELECT fn_remove_group_actor_membership($1::uuid, $2::uuid, $3::uuid) ::text AS membership_id`,
      [tenantId, membershipId, actingActorId]
    );
    const id = (res.rows[0] as { membership_id: string } | undefined)?.membership_id;
    if (!id) throw new Error('GAM_WRITER_NO_RESULT: fn_remove_group_actor_membership nao retornou id.');
    return id;
  }

  /** Intenção explícita (invite|request) do caminho novo, NO client transacional do caller. */
  async createIntent(
    client: PoolClient,
    tenantId: string,
    groupId: string,
    candidateActorId: string,
    initiatorActorId: string,
    intentKind: GroupMembershipIntentKind,
    idempotencyKey: string
  ): Promise<string> {
    const res = await client.query(
      `SELECT fn_create_group_membership_intent($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6) ::text AS intent_id`,
      [tenantId, groupId, candidateActorId, initiatorActorId, intentKind, idempotencyKey]
    );
    const id = (res.rows[0] as { intent_id: string } | undefined)?.intent_id;
    if (!id) throw new Error('GAM_WRITER_NO_RESULT: fn_create_group_membership_intent nao retornou id.');
    return id;
  }

  /** Aceite ATÔMICO (intent accepted + membership na MESMA transação) NO client do caller. */
  async acceptIntent(client: PoolClient, tenantId: string, intentId: string, actingActorId: string): Promise<string> {
    const res = await client.query(
      `SELECT fn_accept_group_membership_intent($1::uuid, $2::uuid, $3::uuid) ::text AS membership_id`,
      [tenantId, intentId, actingActorId]
    );
    const id = (res.rows[0] as { membership_id: string } | undefined)?.membership_id;
    if (!id) throw new Error('GAM_WRITER_NO_RESULT: fn_accept_group_membership_intent nao retornou id.');
    return id;
  }

  async findById(tenantId: string, membershipId: string, existingClient?: PoolClient): Promise<GroupActorMembership | null> {
    const sql = `SELECT ${SELECT_COLS} FROM group_actor_memberships WHERE tenant_id = $1 AND id = $2`;
    if (existingClient) {
      const res = await existingClient.query(sql, [tenantId, membershipId]);
      const row = res.rows[0] as MembershipRow | undefined;
      return row ? toMembership(row) : null;
    }
    const row = await runQueryWithTenant<MembershipRow>(tenantId, sql, [tenantId, membershipId]);
    return row ? toMembership(row) : null;
  }

  async findIntent(
    tenantId: string,
    intentId: string,
    existingClient?: PoolClient
  ): Promise<{ id: string; groupId: string; candidateActorId: string; intentKind: string; status: string } | null> {
    const sql = `SELECT id::text, group_id::text AS group_id, invited_actor_id::text AS candidate_actor_id,
                        intent_kind, status
                   FROM group_invites
                  WHERE tenant_id = $1 AND id = $2 AND intent_kind IS NOT NULL`;
    type Row = { id: string; group_id: string; candidate_actor_id: string; intent_kind: string; status: string };
    let row: Row | undefined;
    if (existingClient) {
      const res = await existingClient.query(sql, [tenantId, intentId]);
      row = res.rows[0] as Row | undefined;
    } else {
      row = await runQueryWithTenant<Row>(tenantId, sql, [tenantId, intentId]);
    }
    return row
      ? { id: row.id, groupId: row.group_id, candidateActorId: row.candidate_actor_id, intentKind: row.intent_kind, status: row.status }
      : null;
  }

  async listByGroup(tenantId: string, groupId: string): Promise<GroupActorMembership[]> {
    const rows = await runQueriesWithTenant<MembershipRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM group_actor_memberships
        WHERE tenant_id = $1 AND group_id = $2 ORDER BY created_at ASC, id ASC`,
      [tenantId, groupId]
    );
    return rows.map(toMembership);
  }
}

export const groupActorMembershipRepository = new GroupActorMembershipRepository();
