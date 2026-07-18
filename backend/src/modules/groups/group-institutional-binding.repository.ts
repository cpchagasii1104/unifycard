// backend/src/modules/groups/group-institutional-binding.repository.ts
// D9.1 (DECISION-0186/0187 + remediação AUTHORITY DUAL TRANSACTION BOUNDARY) — repository PRIVADO
// da casa group_institutional_bindings.
// ESCRITA: exclusivamente via funções canônicas SECURITY DEFINER (fn_bind_group_to_institution /
// fn_retire_group_institutional_binding / fn_reparent_group_institution), invocadas OBRIGATORIAMENTE
// no client transacional do service (transaction owner único) — o MESMO client onde a autoridade
// dual foi provada. unificard_app NÃO tem INSERT/UPDATE/DELETE diretos (migration 20260717120000).
// Este repository NÃO abre conexão própria para escrita e NÃO faz BEGIN/COMMIT/ROLLBACK.
// LEITURA: no client (dentro de transação) ou via pool tenant-scoped sob RLS (read-model).
// Nenhum SQL de Bank; nenhum acesso a actor_relationships/organization_*.

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { GroupInstitutionalBinding } from './group-institutional-binding.types';

interface BindingRow {
  id: string;
  tenant_id: string;
  group_id: string;
  institution_actor_id: string;
  status: string;
  create_idempotency_key: string;
  created_by_actor_id: string;
  created_at: string;
  retire_idempotency_key: string | null;
  retired_by_actor_id: string | null;
  retired_at: string | null;
}

const SELECT_COLS = `
  id::text, tenant_id::text, group_id::text, institution_actor_id::text, status,
  create_idempotency_key, created_by_actor_id::text, created_at,
  retire_idempotency_key, retired_by_actor_id::text, retired_at
`;

function toBinding(r: BindingRow): GroupInstitutionalBinding {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    groupId: r.group_id,
    institutionActorId: r.institution_actor_id,
    status: r.status as GroupInstitutionalBinding['status'],
    createIdempotencyKey: r.create_idempotency_key,
    createdByActorId: r.created_by_actor_id,
    createdAt: r.created_at,
    retireIdempotencyKey: r.retire_idempotency_key,
    retiredByActorId: r.retired_by_actor_id,
    retiredAt: r.retired_at,
  };
}

class GroupInstitutionalBindingRepository {
  /**
   * Cria vínculo via função canônica NO client transacional do caller (único caminho de INSERT).
   * O client é OBRIGATÓRIO: garante que o writer roda na MESMA transação da prova de authority.
   */
  async bind(
    client: PoolClient,
    tenantId: string,
    groupId: string,
    institutionActorId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const res = await client.query(
      `SELECT fn_bind_group_to_institution($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5) ::text AS binding_id`,
      [tenantId, groupId, institutionActorId, actingActorId, idempotencyKey]
    );
    const bindingId = (res.rows[0] as { binding_id: string } | undefined)?.binding_id;
    if (!bindingId) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_bind_group_to_institution nao retornou id.');
    }
    return bindingId;
  }

  /** Retira vínculo via função canônica NO client transacional do caller (terminal). */
  async retire(
    client: PoolClient,
    tenantId: string,
    bindingId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const res = await client.query(
      `SELECT fn_retire_group_institutional_binding($1::uuid, $2::uuid, $3::uuid, $4) ::text AS binding_id`,
      [tenantId, bindingId, actingActorId, idempotencyKey]
    );
    const retiredId = (res.rows[0] as { binding_id: string } | undefined)?.binding_id;
    if (!retiredId) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_retire_group_institutional_binding nao retornou id.');
    }
    return retiredId;
  }

  /** Reparent atômico (retire + nova linha na função canônica) NO client transacional do caller. */
  async reparent(
    client: PoolClient,
    tenantId: string,
    groupId: string,
    newInstitutionActorId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const res = await client.query(
      `SELECT fn_reparent_group_institution($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5) ::text AS binding_id`,
      [tenantId, groupId, newInstitutionActorId, actingActorId, idempotencyKey]
    );
    const newId = (res.rows[0] as { binding_id: string } | undefined)?.binding_id;
    if (!newId) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_reparent_group_institution nao retornou id.');
    }
    return newId;
  }

  async findById(
    tenantId: string,
    bindingId: string,
    existingClient?: PoolClient
  ): Promise<GroupInstitutionalBinding | null> {
    const sql = `SELECT ${SELECT_COLS} FROM group_institutional_bindings WHERE tenant_id = $1 AND id = $2`;
    if (existingClient) {
      const res = await existingClient.query(sql, [tenantId, bindingId]);
      const row = res.rows[0] as BindingRow | undefined;
      return row ? toBinding(row) : null;
    }
    const row = await runQueryWithTenant<BindingRow>(tenantId, sql, [tenantId, bindingId]);
    return row ? toBinding(row) : null;
  }

  async findActiveByGroup(
    tenantId: string,
    groupId: string,
    existingClient?: PoolClient
  ): Promise<GroupInstitutionalBinding | null> {
    const sql = `SELECT ${SELECT_COLS} FROM group_institutional_bindings
        WHERE tenant_id = $1 AND group_id = $2 AND status = 'active'`;
    if (existingClient) {
      const res = await existingClient.query(sql, [tenantId, groupId]);
      const row = res.rows[0] as BindingRow | undefined;
      return row ? toBinding(row) : null;
    }
    const row = await runQueryWithTenant<BindingRow>(tenantId, sql, [tenantId, groupId]);
    return row ? toBinding(row) : null;
  }

  async listByGroup(tenantId: string, groupId: string): Promise<GroupInstitutionalBinding[]> {
    const rows = await runQueriesWithTenant<BindingRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM group_institutional_bindings
        WHERE tenant_id = $1 AND group_id = $2 ORDER BY created_at ASC, id ASC`,
      [tenantId, groupId]
    );
    return rows.map(toBinding);
  }

  /** Filhos ATIVOS de um Actor institucional (group ids). Projeção; zero herança. */
  async listActiveChildrenGroupIds(tenantId: string, institutionActorId: string): Promise<string[]> {
    const rows = await runQueriesWithTenant<{ group_id: string }>(
      tenantId,
      `SELECT group_id::text AS group_id FROM group_institutional_bindings
        WHERE tenant_id = $1 AND institution_actor_id = $2 AND status = 'active'
        ORDER BY group_id ASC`,
      [tenantId, institutionActorId]
    );
    return rows.map((r) => r.group_id);
  }
}

export const groupInstitutionalBindingRepository = new GroupInstitutionalBindingRepository();
