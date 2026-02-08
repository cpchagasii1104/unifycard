// src/core/companies/company-members.repository.ts
// Repository para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { NotFoundError } from '@core/errors';
import type {
  CompanyMember,
  CompanyMemberRow,
  CreateCompanyMemberInput,
  UpdateCompanyMemberInput,
  CompanyMemberFilters,
} from './company-members.types';
import { CompanyMemberRole, CompanyMemberStatus } from './company-members.types';

/**
 * Repository para Company Members
 * 🔴 BLINDAGEM: Repository apenas gerencia dados, não decide comportamento
 */
class CompanyMembersRepository {
  /**
   * Converte linha do banco para entidade de domínio
   */
  private toCompanyMember(row: CompanyMemberRow): CompanyMember {
    return {
      memberId: row.member_id,
      tenantId: row.tenant_id,
      companyId: row.company_id,
      actorId: row.actor_id,
      role: row.role as CompanyMemberRole,
      status: row.status as CompanyMemberStatus,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Cria um novo membro
   */
  async create(
    tenantId: string,
    input: CreateCompanyMemberInput
  ): Promise<CompanyMember> {
    const {
      companyId,
      actorId,
      role = CompanyMemberRole.STAFF,
      status = CompanyMemberStatus.INVITED,
      metadata = {},
    } = input;

    const result = await runQueryWithTenant<CompanyMemberRow>(
      tenantId,
      `
      INSERT INTO company_members (
        tenant_id, company_id, actor_id, role, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [tenantId, companyId, actorId, role, status, JSON.stringify(metadata)]
    );

    if (!result) {
      throw new NotFoundError('Failed to create company member');
    }

    return this.toCompanyMember(result);
  }

  /**
   * Busca membro por ID
   */
  async findById(tenantId: string, memberId: string): Promise<CompanyMember | null> {
    const result = await runQueryWithTenant<CompanyMemberRow>(
      tenantId,
      `
      SELECT *
      FROM company_members
      WHERE tenant_id = $1 AND member_id = $2
      LIMIT 1
      `,
      [tenantId, memberId]
    );

    if (!result) {
      return null;
    }

    return this.toCompanyMember(result);
  }

  /**
   * Busca membros com filtros
   */
  async find(tenantId: string, filters: CompanyMemberFilters): Promise<CompanyMember[]> {
    let query = `
      SELECT *
      FROM company_members
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.companyId) {
      query += ` AND company_id = $${paramIndex}`;
      params.push(filters.companyId);
      paramIndex++;
    }

    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex}`;
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<CompanyMemberRow>(tenantId, query, params);
    return rows.map(this.toCompanyMember);
  }

  /**
   * Atualiza membro
   */
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
      fields.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
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
    paramIndex += 2;

    const result = await runQueryWithTenant<CompanyMemberRow>(
      tenantId,
      `
      UPDATE company_members
      SET ${fields.join(', ')}, updatedAt = now()
      WHERE member_id = $${paramIndex - 1} AND tenant_id = $${paramIndex}
      RETURNING *
      `,
      params
    );

    if (!result) {
      throw new NotFoundError('Company member not found or failed to update');
    }

    return this.toCompanyMember(result);
  }

  /**
   * Remove membro
   */
  async delete(tenantId: string, memberId: string): Promise<void> {
    const result = await runQueryWithTenant<{ member_id: string }>(
      tenantId,
      `
      DELETE FROM company_members
      WHERE tenant_id = $1 AND member_id = $2
      RETURNING member_id
      `,
      [tenantId, memberId]
    );

    if (!result) {
      throw new NotFoundError('Company member not found');
    }
  }
}

export const companyMembersRepository = new CompanyMembersRepository();


