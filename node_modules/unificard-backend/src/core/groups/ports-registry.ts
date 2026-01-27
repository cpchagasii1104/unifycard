// src/core/groups/ports-registry.ts
/**
 * Registry: Groups Ports
 * 
 * Mantém referências para implementações injetadas.
 * Core usa este registry, não importa modules diretamente.
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

import type { GroupsRepositoryPort } from './ports';

class GroupsPortsRegistry {
  private groupsRepository?: GroupsRepositoryPort;

  // Groups Repository
  setGroupsRepository(adapter: GroupsRepositoryPort) {
    this.groupsRepository = adapter;
  }

  getGroupsRepository(): GroupsRepositoryPort {
    if (!this.groupsRepository) {
      throw new Error(
        'GroupsRepository não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.groupsRepository;
  }
}

export const groupsPortsRegistry = new GroupsPortsRegistry();





