// backend/src/modules/marketplace/group.service.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

import { groupRepository } from './group.repository';
import type { Group, CreateGroupInput, GroupFilters } from './group.types';

class GroupService {
  async createGroup(
    tenantId: string,
    input: CreateGroupInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<Group> {
    // Validar parent se fornecido
    if (input.parentGroupId) {
      const parent = await groupRepository.getGroupById(tenantId, input.parentGroupId);
      if (!parent) {
        throw new Error(`Grupo pai não encontrado: ${input.parentGroupId}`);
      }
    }

    const group = await groupRepository.createGroup(tenantId, {
      name: input.name,
      parentGroupId: input.parentGroupId || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'GROUP_CREATED',
      groupId: group.id,
      createdByActorId,
      createdByUserId,
    });

    return group;
  }

  async listGroups(tenantId: string, filters: GroupFilters = {}): Promise<Group[]> {
    return await groupRepository.listGroups(tenantId, filters);
  }

  async getGroupById(tenantId: string, groupId: string): Promise<Group | null> {
    return await groupRepository.getGroupById(tenantId, groupId);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      groupId: string;
      createdByActorId: string;
      createdByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'LOW',
        actor_id: data.createdByActorId,
        actor_type: 'user',
        source: 'marketplace',
        context: {
          group_id: data.groupId,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      console.warn('[Group] Erro ao registrar auditoria:', error);
    }
  }
}

export const groupService = new GroupService();






