// src/modules/groups/groups.service.ts

import { groupsRepository } from './groups.repository';
import { groupAccountService } from '@core/economy/group-account.service';
import { eventBus } from '@core/events/event-bus';
import type { Group, GroupMember, CreateGroupInput, UpdateGroupInput, GroupWithMembers } from './groups.types';

class GroupsService {
  async createGroup(
    tenantId: string,
    ownerUserId: string,
    input: CreateGroupInput
  ): Promise<Group> {
    // Criar grupo
    const group = await groupsRepository.create(tenantId, ownerUserId, input);

    // Criar conta econômica automaticamente
    try {
      await groupAccountService.createOrGetGroupAccount(tenantId, group.groupId);
    } catch (error) {
      // Log mas não quebra
      console.error({
        tenantId,
        groupId: group.groupId,
        err: error,
        'economy.action': 'create-group-account',
      }, 'Error creating group account');
    }

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.created',
      payload: {
        groupId: group.groupId,
        name: group.name,
        ownerUserId: group.ownerUserId,
      },
    });

    return group;
  }

  async getGroup(tenantId: string, groupId: string): Promise<Group | null> {
    return groupsRepository.findById(tenantId, groupId);
  }

  async listGroups(tenantId: string, filters?: { isActive?: boolean }): Promise<Group[]> {
    return groupsRepository.findAll(tenantId, filters);
  }

  async updateGroup(
    tenantId: string,
    groupId: string,
    userId: string,
    input: UpdateGroupInput
  ): Promise<Group> {
    // Verificar se usuário é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.ownerUserId !== userId) {
      throw new Error('Only the owner can update the group');
    }

    return groupsRepository.update(tenantId, groupId, input);
  }

  async deleteGroup(tenantId: string, groupId: string, userId: string): Promise<boolean> {
    // Verificar se usuário é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.ownerUserId !== userId) {
      throw new Error('Only the owner can delete the group');
    }

    return groupsRepository.delete(tenantId, groupId);
  }

  async joinGroup(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<GroupMember> {
    // Verificar limite de grupos
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, userId);
    if (currentCount >= 3) {
      throw new Error('User cannot be in more than 3 groups');
    }

    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // Adicionar membro
    const member = await groupsRepository.addMember(tenantId, groupId, userId, 'member');

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId,
        userId,
        role: member.role,
      },
    });

    return member;
  }

  async leaveGroup(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<boolean> {
    // Verificar se é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.ownerUserId === userId) {
      throw new Error('Owner cannot leave without transferring ownership');
    }

    const removed = await groupsRepository.removeMember(tenantId, groupId, userId);

    if (removed) {
      // Emitir evento
      await eventBus.publish({
        tenantId,
        type: 'group.member.left',
        payload: {
          groupId,
          userId,
        },
      });
    }

    return removed;
  }

  async getGroupMembers(tenantId: string, groupId: string): Promise<GroupMember[]> {
    return groupsRepository.getMembers(tenantId, groupId);
  }

  async getGroupWithMembers(tenantId: string, groupId: string): Promise<GroupWithMembers | null> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      return null;
    }

    const members = await groupsRepository.getMembers(tenantId, groupId);

    return {
      ...group,
      members,
      memberCount: members.length,
    };
  }

  async getUserGroups(tenantId: string, userId: string): Promise<Group[]> {
    return groupsRepository.getUserGroups(tenantId, userId);
  }
}

export const groupsService = new GroupsService();








