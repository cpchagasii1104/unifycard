// src/modules/groups/groups.types.ts

export type GroupMemberRole = 'member' | 'moderator' | 'owner';

export interface Group {
  groupId: string;
  tenantId: string;
  name: string;
  description?: string;
  ownerUserId: string; // global_user_id
  isActive: boolean;
  profitPercentage?: number; // 0-100, percentual de lucro que o grupo recebe
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  groupId: string;
  userId: string; // global_user_id
  role: GroupMemberRole;
  joinedAt: Date;
}

export interface GroupAccount {
  groupId: string;
  accountId: string;
  createdAt: Date;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
  profit_percentage?: number; // 0-100
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  memberCount: number;
}

export interface GroupInsights {
  groupId: string;
  name: string;
  totalReceived: number;
  memberCount: number;
  impactGenerated?: string;
  participationLogs: Array<{
    action: string;
    timestamp: Date;
    userId: string;
  }>;
  aiSummary?: string;
}








