import type { Group, GroupMember, GroupAccount, CreateGroupInput, UpdateGroupInput } from './groups.types';
declare class GroupsRepository {
    private toGroup;
    private toGroupMember;
    create(tenantId: string, ownerUserId: string, input: CreateGroupInput): Promise<Group>;
    findById(tenantId: string, groupId: string): Promise<Group | null>;
    findAll(tenantId: string, filters?: {
        isActive?: boolean;
    }): Promise<Group[]>;
    update(tenantId: string, groupId: string, input: UpdateGroupInput): Promise<Group>;
    delete(tenantId: string, groupId: string): Promise<boolean>;
    addMember(tenantId: string, groupId: string, userId: string, role?: GroupMember['role']): Promise<GroupMember>;
    removeMember(tenantId: string, groupId: string, userId: string): Promise<boolean>;
    getMembers(tenantId: string, groupId: string): Promise<GroupMember[]>;
    getUserGroups(tenantId: string, userId: string): Promise<Group[]>;
    getUserGroupCount(tenantId: string, userId: string): Promise<number>;
    linkAccount(tenantId: string, groupId: string, accountId: string): Promise<GroupAccount>;
    getGroupAccount(tenantId: string, groupId: string): Promise<GroupAccount | null>;
}
export declare const groupsRepository: GroupsRepository;
export {};
//# sourceMappingURL=groups.repository.d.ts.map