export interface GroupSocialInfo {
    groupId: string;
    name: string;
    description?: string;
    memberCount: number;
    totalReceived: number;
    recentPosts: number;
    indicators: {
        growthRate?: number;
        activeMembers?: number;
        avgPostPerMember?: number;
    };
}
export interface GroupFeedOptions {
    limit?: number;
    offset?: number;
    includeAutoPosts?: boolean;
}
export interface GroupFeedResult {
    posts: Array<{
        postId: string;
        content: string;
        globalUserId: string;
        createdAt: Date;
        metadata: Record<string, any>;
        isAutoPost?: boolean;
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
//# sourceMappingURL=social-group.types.d.ts.map