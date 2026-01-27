// backend/src/modules/organization/organization-authorization.helper.ts
// SPRINT 78: Helper para integrar Organization Roles com AuthorizationService

import { organizationMemberRepository } from './organization-member.repository';
import { organizationRoleRepository } from './organization-role.repository';
import type { OrganizationRoleKey } from './organization.types';

/**
 * Helper para verificar permissões baseadas em organization roles
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Papéis controlam permissões (integra com permission system existente)
 * - Não cria permissões mágicas
 * - Tudo explícito e auditável
 */
export class OrganizationAuthorizationHelper {
  /**
   * Verifica se usuário tem papel organizacional específico
   */
  static async hasRole(
    tenantId: string,
    userId: string,
    actorId: string,
    roleKey: OrganizationRoleKey
  ): Promise<boolean> {
    const member = await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
    if (!member || member.status !== 'ACTIVE') {
      return false;
    }

    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (!role) {
      return false;
    }

    return role.roleKey === roleKey;
  }

  /**
   * Verifica se usuário tem qualquer um dos papéis especificados
   */
  static async hasAnyRole(
    tenantId: string,
    userId: string,
    actorId: string,
    roleKeys: OrganizationRoleKey[]
  ): Promise<boolean> {
    const member = await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
    if (!member || member.status !== 'ACTIVE') {
      return false;
    }

    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (!role) {
      return false;
    }

    return roleKeys.includes(role.roleKey);
  }

  /**
   * Busca papel do usuário na organização
   */
  static async getUserRole(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<OrganizationRoleKey | null> {
    const member = await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
    if (!member || member.status !== 'ACTIVE') {
      return null;
    }

    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (!role) {
      return null;
    }

    return role.roleKey;
  }
}





