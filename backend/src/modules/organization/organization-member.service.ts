// backend/src/modules/organization/organization-member.service.ts
// SPRINT 78: Service para Organization Members

import { organizationMemberRepository } from './organization-member.repository';
import { organizationRoleRepository } from './organization-role.repository';
import type {
  OrganizationMember,
  OrganizationMemberFilters,
} from './organization.types';

/**
 * Service para Organization Members
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Aceite exige aceite explícito
 * - Sem aceite = sem acesso
 * - Um usuário pode pertencer a várias organizações
 * - Tudo explícito e auditável
 */
class OrganizationMemberService {
  /**
   * Adiciona membro (chamado após aceite de convite)
   */
  async addMember(
    tenantId: string,
    input: {
      actorId: string;
      userId: string;
      roleId: string;
    }
  ): Promise<OrganizationMember> {
    const member = await organizationMemberRepository.createMember(tenantId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_MEMBER_ADDED',
      memberId: member.id,
      userId: input.userId,
      actorId: input.actorId,
      roleId: input.roleId,
    });

    return member;
  }

  /**
   * Remove membro
   */
  async removeMember(
    tenantId: string,
    memberId: string,
    removedByUserId: string,
    removedByActorId: string
  ): Promise<void> {
    // Validar que quem remove tem permissão (OWNER ou ADMIN)
    await this.validateCanManageMembers(tenantId, removedByUserId, removedByActorId);

    // Buscar membro
    const member = await organizationMemberRepository.getMemberById(tenantId, memberId);
    if (!member) {
      throw new Error('Membro não encontrado');
    }

    // Não permitir remover OWNER
    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (role?.roleKey === 'OWNER') {
      throw new Error('Não é possível remover o OWNER da organização');
    }

    await organizationMemberRepository.removeMember(tenantId, memberId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_MEMBER_REMOVED',
      memberId,
      removedUserId: member.userId,
      removedByUserId,
    });
  }

  /**
   * Muda papel do membro
   */
  async changeRole(
    tenantId: string,
    memberId: string,
    roleKey: string,
    changedByUserId: string,
    changedByActorId: string
  ): Promise<OrganizationMember> {
    // Validar que quem muda tem permissão (OWNER ou ADMIN)
    await this.validateCanManageMembers(tenantId, changedByUserId, changedByActorId);

    // Buscar role
    const role = await organizationRoleRepository.getRoleByKey(tenantId, roleKey);
    if (!role) {
      throw new Error(`Papel não encontrado: ${roleKey}`);
    }

    // Buscar membro
    const member = await organizationMemberRepository.getMemberById(tenantId, memberId);
    if (!member) {
      throw new Error('Membro não encontrado');
    }

    // Não permitir mudar papel do OWNER
    const currentRole = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (currentRole?.roleKey === 'OWNER') {
      throw new Error('Não é possível mudar o papel do OWNER');
    }

    const updatedMember = await organizationMemberRepository.changeRole(tenantId, memberId, role.id);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_ROLE_CHANGED',
      memberId,
      userId: updatedMember.userId,
      oldRoleKey: currentRole?.roleKey,
      newRoleKey: roleKey,
      changedByUserId,
    });

    return updatedMember;
  }

  /**
   * Lista membros
   */
  async listMembers(
    tenantId: string,
    filters: OrganizationMemberFilters = {}
  ): Promise<OrganizationMember[]> {
    return await organizationMemberRepository.listMembers(tenantId, filters);
  }

  /**
   * Busca membro por ID
   */
  async getMemberById(tenantId: string, memberId: string): Promise<OrganizationMember | null> {
    return await organizationMemberRepository.getMemberById(tenantId, memberId);
  }

  /**
   * Busca membro por usuário
   */
  async getMemberByUser(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<OrganizationMember | null> {
    return await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
  }

  /**
   * Suspende membro
   */
  async suspendMember(
    tenantId: string,
    memberId: string,
    suspendedByUserId: string,
    suspendedByActorId: string
  ): Promise<OrganizationMember> {
    // Validar que quem suspende tem permissão (OWNER ou ADMIN)
    await this.validateCanManageMembers(tenantId, suspendedByUserId, suspendedByActorId);

    // Buscar membro
    const member = await organizationMemberRepository.getMemberById(tenantId, memberId);
    if (!member) {
      throw new Error('Membro não encontrado');
    }

    // Não permitir suspender OWNER
    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (role?.roleKey === 'OWNER') {
      throw new Error('Não é possível suspender o OWNER da organização');
    }

    const suspendedMember = await organizationMemberRepository.suspendMember(tenantId, memberId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_MEMBER_SUSPENDED',
      memberId,
      suspendedUserId: member.userId,
      suspendedByUserId,
    });

    return suspendedMember;
  }

  /**
   * Valida que usuário pode gerenciar membros (OWNER ou ADMIN)
   */
  private async validateCanManageMembers(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<void> {
    // Buscar membro
    const member = await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
    if (!member || member.status !== 'ACTIVE') {
      throw new Error('Usuário não é membro ativo da organização');
    }

    // Buscar role
    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (!role) {
      throw new Error('Papel não encontrado');
    }

    // Validar que é OWNER ou ADMIN
    if (role.roleKey !== 'OWNER' && role.roleKey !== 'ADMIN') {
      throw new Error('Apenas OWNER ou ADMIN pode gerenciar membros');
    }
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      memberId: string;
      userId?: string;
      actorId?: string;
      roleId?: string;
      oldRoleKey?: string;
      newRoleKey?: string;
      removedUserId?: string;
      removedByUserId?: string;
      suspendedUserId?: string;
      suspendedByUserId?: string;
      changedByUserId?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.removedByUserId || data.suspendedByUserId || data.changedByUserId || data.userId || null,
        actor_type: 'user',
        source: 'organization',
        context: {
          member_id: data.memberId,
          user_id: data.userId,
          actor_id: data.actorId,
          role_id: data.roleId,
          old_role_key: data.oldRoleKey,
          new_role_key: data.newRoleKey,
          removed_user_id: data.removedUserId,
          removed_by_user_id: data.removedByUserId,
          suspended_user_id: data.suspendedUserId,
          suspended_by_user_id: data.suspendedByUserId,
          changed_by_user_id: data.changedByUserId,
        },
      });
    } catch (error) {
      console.warn('[OrganizationMember] Erro ao registrar auditoria:', error);
    }
  }
}

export const organizationMemberService = new OrganizationMemberService();





