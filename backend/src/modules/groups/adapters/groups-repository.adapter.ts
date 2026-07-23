// src/modules/groups/adapters/groups-repository.adapter.ts
/**
 * Adapter: Groups Repository
 * 
 * Implementa interface do core usando repository real do module.
 */

import type { GroupsRepositoryPort, Group } from '@core/groups/ports';
import { groupsRepository as realRepo } from '../groups.repository';
import { groupsService } from '../groups.service';

export class GroupsRepositoryAdapter implements GroupsRepositoryPort {
  private toPortGroup(group: any): Group {
    return {
      ...group,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
    };
  }

  async findById(tenantId: string, groupId: string): Promise<Group | null> {
    const group = await realRepo.findById(tenantId, groupId);
    return group ? this.toPortGroup(group) : null;
  }

  // D9.2-B: autoridade de gestao = canRepresentActor (nunca role em group_members)
  async userCanGovernGroup(tenantId: string, groupId: string, userId: string) {
    return groupsService.userCanGovernGroup(tenantId, groupId, userId);
  }
}

export const groupsRepositoryAdapter = new GroupsRepositoryAdapter();





