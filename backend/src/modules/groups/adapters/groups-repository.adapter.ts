// src/modules/groups/adapters/groups-repository.adapter.ts
/**
 * Adapter: Groups Repository
 * 
 * Implementa interface do core usando repository real do module.
 */

import type { GroupsRepositoryPort } from '@core/groups/ports';
import { groupsRepository as realRepo } from '../groups.repository';

export class GroupsRepositoryAdapter implements GroupsRepositoryPort {
  async findById(tenantId: string, groupId: string) {
    return realRepo.findById(tenantId, groupId);
  }

  async isUserAdminOrOwner(tenantId: string, groupId: string, userId: string) {
    return realRepo.isUserAdminOrOwner(tenantId, groupId, userId);
  }
}

export const groupsRepositoryAdapter = new GroupsRepositoryAdapter();





