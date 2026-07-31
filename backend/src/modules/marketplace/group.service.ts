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
    if (input.parentGroupId !== undefined) {
      throw new Error('parentGroupId não é suportado — hierarquia de grupos não implementada');
    }
    if (createdByUserId !== undefined) {
      throw new Error('createdByUserId não é suportado — usar actorId via contexto');
    }

    const group = await groupRepository.createGroup(tenantId, {
      name: input.name,
      createdByActorId,
      metadata: input.metadata || {},
    });

    await this.recordAudit(tenantId, {
      eventType: 'GROUP_CREATED',
      groupId: group.id,
      createdByActorId,
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
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'INFO',
        actor_id: data.createdByActorId,
        actor_type: 'user',
        source: 'validation',
        context: {
          group_id: data.groupId,
        },
      });
    } catch (error) {
      console.warn('[Group] Erro ao registrar auditoria:', error);
    }
  }
}

export const groupService = new GroupService();
