// src/core/companies/company-members.service.ts
// Service para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário
//
// 🔒 DECISION-0189 (F4 — CUTOVER): membership empresarial NÃO usa mais actor_delegations
// como fonte de autoridade. A autoridade vive em company_users.can_* (subject grants) +
// casa jurídica company_member_relationships + trilha company_member_events.
//   • criação direta de membro MORREU (só bootstrap e aceite canônico criam 'active' — R17);
//   • lifecycle (suspend/resume/revoke) e grants = COMANDOS GOVERNADOS
//     (company-membership-commands.service — dois tetos + lock da empresa + último gestor);
//   • a dual-write transitória da F2 foi DESLIGADA aqui (F6 só remove código morto);
//   • wildcard '*' e scopes funcionais por role MORRERAM (§12 — destino: subject grants);
//   • DELETE físico inexiste (revogação lógica via comando).
// Este service mantém APENAS leituras e atualização de RÓTULOS (role/metadata — nunca authority).

import { companyMembersRepository } from './company-members.repository';
import { runQueryWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import type {
  CompanyMember,
  UpdateCompanyMemberInput,
  CompanyMemberFilters,
} from './company-members.types';

class CompanyMembersService {
  /**
   * Busca membro por ID
   */
  async getMember(tenantId: string, memberId: string): Promise<CompanyMember> {
    const member = await companyMembersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError('Membro não encontrado');
    }
    return member;
  }

  /**
   * Lista membros com filtros
   */
  async listMembers(
    tenantId: string,
    filters: CompanyMemberFilters
  ): Promise<CompanyMember[]> {
    return await companyMembersRepository.find(tenantId, filters);
  }

  /**
   * Atualiza RÓTULOS do membro (role/metadata). role é rótulo de UI — NUNCA authority (§5).
   * Mudança de STATUS ou de GRANTS aqui é PROIBIDA — comandos governados são o único caminho.
   */
  async updateMemberLabels(
    tenantId: string,
    memberId: string,
    input: UpdateCompanyMemberInput
  ): Promise<CompanyMember> {
    if (input.status !== undefined) {
      throw new BadRequestError(
        'Mudança de status por PUT genérico morreu (DECISION-0189 R17) — use os comandos governados suspend/resume/revoke'
      );
    }
    const existing = await companyMembersRepository.findById(tenantId, memberId);
    if (!existing) {
      throw new NotFoundError('Membro não encontrado');
    }
    return companyMembersRepository.update(tenantId, memberId, {
      role: input.role,
      metadata: input.metadata,
    });
  }

  /**
   * Leitura pura: membro existe e está ativo? (usado por superfícies de projeção)
   */
  async isActiveMember(tenantId: string, companyId: string, globalUserId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT true AS ok FROM company_users
        WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid
          AND member_status = 'active' LIMIT 1`,
      [tenantId, companyId, globalUserId]
    );
    return row?.ok === true;
  }
}

export const companyMembersService = new CompanyMembersService();
