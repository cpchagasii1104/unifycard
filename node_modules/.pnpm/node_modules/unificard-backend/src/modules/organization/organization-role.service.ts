// backend/src/modules/organization/organization-role.service.ts
// SPRINT 78: Service para Organization Roles

import { organizationRoleRepository } from './organization-role.repository';
import type { OrganizationRole } from './organization.types';

/**
 * Service para Organization Roles
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Papéis controlam permissões (integra com permission system existente)
 * - Tudo explícito e auditável
 * - Sem criar permissões mágicas
 */
class OrganizationRoleService {
  /**
   * Lista todos os papéis organizacionais
   */
  async listRoles(tenantId: string): Promise<OrganizationRole[]> {
    return await organizationRoleRepository.listRoles(tenantId);
  }

  /**
   * Busca papel por chave
   */
  async getRoleByKey(tenantId: string, roleKey: string): Promise<OrganizationRole | null> {
    return await organizationRoleRepository.getRoleByKey(tenantId, roleKey);
  }

  /**
   * Busca papel por ID
   */
  async getRoleById(tenantId: string, roleId: string): Promise<OrganizationRole | null> {
    return await organizationRoleRepository.getRoleById(tenantId, roleId);
  }
}

export const organizationRoleService = new OrganizationRoleService();





