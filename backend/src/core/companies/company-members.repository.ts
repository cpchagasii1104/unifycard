// src/core/companies/company-members.repository.ts
// DECISION-0042 (2026-05-16): adapter thin sobre `company_users` (SSOT unico).
// company_members.* (tabela) foi descartada — frente MEMBERSHIP consolidou
// role-based membership em company_users (9 rows vivas + colunas role +
// member_status adicionadas via migration 20260530541000).
//
// Esta camada preserva a interface CompanyMember/CRUD para que callers
// upstream (service, routes, frontend) continuem inalterados.
//
// Mapeamento:
//   member_id    ↔ company_users.id
//   actor_id     ↔ derivado de global_user_id (JOIN actors via users)
//   role/status  ↔ company_users.role / company_users.member_status
//   metadata     ↔ company_users.metadata

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { NotFoundError, BadRequestError } from '@core/errors';
import type {
  CompanyMember,
  UpdateCompanyMemberInput,
  CompanyMemberFilters,
} from './company-members.types';
import { CompanyMemberRole, CompanyMemberStatus } from './company-members.types';

interface CompanyUserAdapterRow {
  id: string;
  tenant_id: string;
  company_id: string;
  global_user_id: string;
  actor_id: string | null;
  role: string;
  member_status: string;
  metadata: Record<string, any> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const SELECT_WITH_ACTOR = `
  SELECT
    cu.id,
    cu.tenant_id,
    cu.company_id,
    cu.global_user_id,
    a.actor_id,
    cu.role,
    cu.member_status,
    cu.metadata,
    cu.created_at,
    cu.updated_at
  FROM company_users cu
  LEFT JOIN users u
    ON u.global_user_id = cu.global_user_id
   AND u.tenant_id = cu.tenant_id
  LEFT JOIN actors a
    ON a.user_id = u.user_id
   AND a.tenant_id = cu.tenant_id
   AND a.actor_type = 'user'
`;

class CompanyMembersRepository {
  private toCompanyMember(row: CompanyUserAdapterRow): CompanyMember {
    const createdAt =
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    const updatedAt =
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);

    return {
      memberId: row.id,
      tenantId: row.tenant_id,
      companyId: row.company_id,
      actorId: row.actor_id ?? row.global_user_id,
      role: row.role as CompanyMemberRole,
      status: row.member_status as CompanyMemberStatus,
      metadata: row.metadata || {},
      createdAt,
      updatedAt,
    };
  }

  private async resolveGlobalUserIdFromActor(
    tenantId: string,
    actorId: string
  ): Promise<string> {
    const row = await runQueryWithTenant<{ global_user_id: string }>(
      tenantId,
      `
        SELECT u.global_user_id
        FROM actors a
        JOIN users u ON u.user_id = a.user_id AND u.tenant_id = a.tenant_id
        WHERE a.actor_id = $1
          AND a.tenant_id = $2
          AND a.actor_type = 'user'
        LIMIT 1
      `,
      [actorId, tenantId]
    );

    if (!row || !row.global_user_id) {
      throw new BadRequestError(
        `Actor ${actorId} não resolvível para global_user_id (precisa ser actor_type='user')`
      );
    }

    return row.global_user_id;
  }

  // DECISION-0189 (F4): create() MORREU - so bootstrap (createCompany) e o aceite
  // canonico de convite (F5) criam membership active (R17). Reentrada pos-revoked e
  // substituicao integral no writer do aceite, nunca upsert generico.

  async findById(tenantId: string, memberId: string): Promise<CompanyMember | null> {
    const row = await runQueryWithTenant<CompanyUserAdapterRow>(
      tenantId,
      `${SELECT_WITH_ACTOR}
        WHERE cu.tenant_id = $1 AND cu.id = $2
        LIMIT 1
      `,
      [tenantId, memberId]
    );

    return row ? this.toCompanyMember(row) : null;
  }

  async find(tenantId: string, filters: CompanyMemberFilters): Promise<CompanyMember[]> {
    let query = `${SELECT_WITH_ACTOR} WHERE cu.tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.companyId) {
      query += ` AND cu.company_id = $${paramIndex}`;
      params.push(filters.companyId);
      paramIndex++;
    }

    if (filters.actorId) {
      const globalUserId = await this.resolveGlobalUserIdFromActor(tenantId, filters.actorId);
      query += ` AND cu.global_user_id = $${paramIndex}`;
      params.push(globalUserId);
      paramIndex++;
    }

    if (filters.role) {
      query += ` AND cu.role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND cu.member_status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY cu.created_at DESC`;

    const rows = await runQueriesWithTenant<CompanyUserAdapterRow>(tenantId, query, params);
    return rows.map((row) => this.toCompanyMember(row));
  }

  async update(
    tenantId: string,
    memberId: string,
    input: UpdateCompanyMemberInput
  ): Promise<CompanyMember> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.role !== undefined) {
      fields.push(`role = $${paramIndex}`);
      params.push(input.role);
      paramIndex++;
    }

    if (input.status !== undefined) {
      fields.push(`member_status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
      // DECISION-0189 (F4): is_active morreu — nenhum sincronismo; member_status é o estado único.
    }

    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (fields.length === 0) {
      const existing = await this.findById(tenantId, memberId);
      if (!existing) {
        throw new NotFoundError('Company member not found');
      }
      return existing;
    }

    params.push(memberId, tenantId);
    const memberIdIdx = paramIndex;
    const tenantIdIdx = paramIndex + 1;

    const result = await runQueryWithTenant(
      tenantId,
      `
        UPDATE company_users
        SET ${fields.join(', ')}, updated_at = now()
        WHERE id = $${memberIdIdx} AND tenant_id = $${tenantIdIdx}
        RETURNING id
      `,
      params
    );

    if (!result) {
      throw new NotFoundError('Company member not found or failed to update');
    }

    const updated = await this.findById(tenantId, memberId);
    if (!updated) {
      throw new NotFoundError('Company member not found after update');
    }
    return updated;
  }

  // DECISION-0189 (§12 condenações): DELETE físico de membership MORREU. Revogação é LÓGICA
  // (member_status='revoked' + grants zerados + evento com snapshot) — ver
  // companyMembersService.removeMember. Método delete() removido nesta fatia (zero callers).
}

export const companyMembersRepository = new CompanyMembersRepository();
