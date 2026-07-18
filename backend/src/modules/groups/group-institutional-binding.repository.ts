// backend/src/modules/groups/group-institutional-binding.repository.ts
// D9.1 (DECISION-0186/0187) — repository PRIVADO da casa group_institutional_bindings.
// ESCRITA: exclusivamente via funcoes canonicas SECURITY DEFINER (fn_bind_group_to_institution /
// fn_retire_group_institutional_binding / fn_reparent_group_institution) — unificard_app NAO tem
// INSERT/UPDATE/DELETE diretos (fronteira fechada na migration 20260717120000). LEITURA: SELECT
// tenant-scoped sob RLS. Nenhum SQL de Bank; nenhum acesso a actor_relationships/organization_*.

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
  /** Cria vinculo via funcao canonica (unico caminho de INSERT). Retorna o binding id. */
  async bind(
    tenantId: string,
    groupId: string,
    institutionActorId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const row = await runQueryWithTenant<{ binding_id: string }>(
      tenantId,
      `SELECT fn_bind_group_to_institution($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5) ::text AS binding_id`,
      [tenantId, groupId, institutionActorId, actingActorId, idempotencyKey]
    );
    if (!row?.binding_id) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_bind_group_to_institution nao retornou id.');
    }
    return row.binding_id;
  }

  /** Retira vinculo via funcao canonica (unico caminho de retirada; terminal). */
  async retire(
    tenantId: string,
    bindingId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const row = await runQueryWithTenant<{ binding_id: string }>(
      tenantId,
      `SELECT fn_retire_group_institutional_binding($1::uuid, $2::uuid, $3::uuid, $4) ::text AS binding_id`,
      [tenantId, bindingId, actingActorId, idempotencyKey]
    );
    if (!row?.binding_id) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_retire_group_institutional_binding nao retornou id.');
    }
    return row.binding_id;
  }

  /** Reparent atomico (retire + nova linha na MESMA transacao da funcao canonica). */
  async reparent(
    tenantId: string,
    groupId: string,
    newInstitutionActorId: string,
    actingActorId: string,
    idempotencyKey: string
  ): Promise<string> {
    const row = await runQueryWithTenant<{ binding_id: string }>(
      tenantId,
      `SELECT fn_reparent_group_institution($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5) ::text AS binding_id`,
      [tenantId, groupId, newInstitutionActorId, actingActorId, idempotencyKey]
    );
    if (!row?.binding_id) {
      throw new Error('GIB_WRITER_NO_RESULT: fn_reparent_group_institution nao retornou id.');
    }
    return row.binding_id;
  }

  async findById(tenantId: string, bindingId: string): Promise<GroupInstitutionalBinding | null> {
    const row = await runQueryWithTenant<BindingRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM group_institutional_bindings WHERE tenant_id = $1 AND id = $2`,
      [tenantId, bindingId]
    );
    return row ? toBinding(row) : null;
  }

  async findActiveByGroup(tenantId: string, groupId: string): Promise<GroupInstitutionalBinding | null> {
    const row = await runQueryWithTenant<BindingRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM group_institutional_bindings
        WHERE tenant_id = $1 AND group_id = $2 AND status = 'active'`,
      [tenantId, groupId]
    );
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

  /** Filhos ATIVOS de um Actor institucional (group ids). Projecao; zero heranca. */
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
