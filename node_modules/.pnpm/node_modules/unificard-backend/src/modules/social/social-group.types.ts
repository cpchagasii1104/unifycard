// src/modules/social/social-group.types.ts

export interface GroupSocialInfo {
  groupId: string;
  name: string;
  description?: string;
  memberCount: number;
  totalReceived: number; // Total recebido em splits
  recentPosts: number; // Posts dos últimos 30 dias
  indicators: {
    growthRate?: number; // Crescimento mensal
    activeMembers?: number; // Membros ativos
    avgPostPerMember?: number; // Média de posts por membro
  };
}

export interface GroupFeedOptions {
  limit?: number;
  offset?: number;
  includeAutoPosts?: boolean; // Incluir auto-posts econômicos
}

export interface GroupFeedResult {
  posts: Array<{
    postId: string;
    content: string;
    globalUserId: string;
    createdAt: Date;
    metadata: Record<string, any>;
    isAutoPost?: boolean; // Se é auto-post econômico
  }>;
  total: number;
  hasMore: boolean;
}

export interface GroupInsights {
  groupId: string;
  name: string;
  totalReceived: number;
  recentAutoPosts: Array<{
    postId: string;
    content: string;
    amount: number;
    createdAt: Date;
    assignmentId?: string;
    jobId?: string;
  }>;
  monthlyGrowth: {
    month: string;
    amount: number;
  }[];
  memberCount: number;
  mostActiveMember?: {
    userId: string;
    postCount: number;
  };
  frequentActivities: Array<{
    activity: string;
    count: number;
  }>;
}

export interface ImpactFeedItem {
  type: 'economic_auto_post' | 'group_post' | 'user_activity';
  postId?: string;
  content: string;
  globalUserId?: string;
  groupId?: string;
  amount?: number;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface ImpactFeedResult {
  items: ImpactFeedItem[];
  total: number;
  hasMore: boolean;
}

export interface AISummaryResult {
  summary: string;
  suggestions: string[];
  metrics: {
    totalImpact: number;
    groupsCount: number;
    recentActivity: number;
  };
}








