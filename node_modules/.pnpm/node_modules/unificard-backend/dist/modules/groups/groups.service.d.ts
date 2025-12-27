import type { Group, GroupMember, CreateGroupInput, UpdateGroupInput, GroupWithMembers } from './groups.types';
declare class GroupsService {
    createGroup(tenantId: string, ownerUserId: string, input: CreateGroupInput): Promise<Group>;
    getGroup(tenantId: string, groupId: string): Promise<Group | null>;
    listGroups(tenantId: string, filters?: {
        isActive?: boolean;
    }): Promise<Group[]>;
    updateGroup(tenantId: string, groupId: string, userId: string, input: UpdateGroupInput): Promise<Group>;
    deleteGroup(tenantId: string, groupId: string, userId: string): Promise<boolean>;
    joinGroup(tenantId: string, groupId: string, userId: string): Promise<GroupMember>;
    leaveGroup(tenantId: string, groupId: string, userId: string): Promise<boolean>;
    getGroupMembers(tenantId: string, groupId: string): Promise<GroupMember[]>;
    getGroupWithMembers(tenantId: string, groupId: string): Promise<GroupWithMembers | null>;
    getUserGroups(tenantId: string, userId: string): Promise<Group[]>;
}
export declare const groupsService: GroupsService;
export {};
//# sourceMappingURL=groups.service.d.ts.map