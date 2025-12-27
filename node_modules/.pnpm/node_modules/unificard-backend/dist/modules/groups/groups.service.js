"use strict";
// src/modules/groups/groups.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsService = void 0;
const groups_repository_1 = require("./groups.repository");
const group_account_service_1 = require("@core/economy/group-account.service");
const event_bus_1 = require("@core/events/event-bus");
class GroupsService {
    async createGroup(tenantId, ownerUserId, input) {
        // Criar grupo
        const group = await groups_repository_1.groupsRepository.create(tenantId, ownerUserId, input);
        // Criar conta econômica automaticamente
        try {
            await group_account_service_1.groupAccountService.createOrGetGroupAccount(tenantId, group.groupId);
        }
        catch (error) {
            // Log mas não quebra
            console.error({
                tenantId,
                groupId: group.groupId,
                err: error,
                'economy.action': 'create-group-account',
            }, 'Error creating group account');
        }
        // Emitir evento
        await event_bus_1.eventBus.publish({
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
    async getGroup(tenantId, groupId) {
        return groups_repository_1.groupsRepository.findById(tenantId, groupId);
    }
    async listGroups(tenantId, filters) {
        return groups_repository_1.groupsRepository.findAll(tenantId, filters);
    }
    async updateGroup(tenantId, groupId, userId, input) {
        // Verificar se usuário é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (group.ownerUserId !== userId) {
            throw new Error('Only the owner can update the group');
        }
        return groups_repository_1.groupsRepository.update(tenantId, groupId, input);
    }
    async deleteGroup(tenantId, groupId, userId) {
        // Verificar se usuário é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (group.ownerUserId !== userId) {
            throw new Error('Only the owner can delete the group');
        }
        return groups_repository_1.groupsRepository.delete(tenantId, groupId);
    }
    async joinGroup(tenantId, groupId, userId) {
        // Verificar limite de grupos
        const currentCount = await groups_repository_1.groupsRepository.getUserGroupCount(tenantId, userId);
        if (currentCount >= 3) {
            throw new Error('User cannot be in more than 3 groups');
        }
        // Verificar se grupo existe e está ativo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (!group.isActive) {
            throw new Error('Group is not active');
        }
        // Adicionar membro
        const member = await groups_repository_1.groupsRepository.addMember(tenantId, groupId, userId, 'member');
        // Emitir evento
        await event_bus_1.eventBus.publish({
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
    async leaveGroup(tenantId, groupId, userId) {
        // Verificar se é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (group.ownerUserId === userId) {
            throw new Error('Owner cannot leave without transferring ownership');
        }
        const removed = await groups_repository_1.groupsRepository.removeMember(tenantId, groupId, userId);
        if (removed) {
            // Emitir evento
            await event_bus_1.eventBus.publish({
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
    async getGroupMembers(tenantId, groupId) {
        return groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
    }
    async getGroupWithMembers(tenantId, groupId) {
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            return null;
        }
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        return {
            ...group,
            members,
            memberCount: members.length,
        };
    }
    async getUserGroups(tenantId, userId) {
        return groups_repository_1.groupsRepository.getUserGroups(tenantId, userId);
    }
}
exports.groupsService = new GroupsService();
//# sourceMappingURL=groups.service.js.map