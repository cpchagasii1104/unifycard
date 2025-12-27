export type PostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER';
export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'FRIENDS' | 'GROUP';
export interface Post {
    postId: string;
    tenantId: string;
    globalUserId: string;
    content: string;
    type?: PostType;
    visibility?: PostVisibility;
    media: MediaItem[];
    intent?: string | null;
    confidence?: number | null;
    categories: string[];
    suggestedActions: SuggestedAction[];
    metadata: Record<string, any>;
    jobId?: string;
    eventId?: string | null;
    serviceInfo?: ServiceInfo;
    isServicePost?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface PostRow {
    post_id: string;
    tenant_id: string;
    global_user_id: string;
    content: string;
    type: string | null;
    visibility: string | null;
    media: any;
    intent: string | null;
    confidence: number | null;
    categories: string[];
    suggested_actions: any;
    metadata: any;
    event_id: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface MediaItem {
    type: 'image' | 'video' | 'audio';
    url: string;
    thumbnailUrl?: string;
    duration?: number;
    metadata?: Record<string, any>;
}
export interface SuggestedAction {
    action: string;
    module: string;
    endpoint?: string;
    payload?: Record<string, any>;
    description: string;
}
export interface ServiceInfo {
    categoryId?: string;
    categoryName?: string;
    price?: number;
    pricingType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
    currency?: string;
    description?: string;
    duration?: number;
    requiresSchedule?: boolean;
    requiresPayment?: boolean;
}
export interface CreatePostInput {
    content: string;
    media?: MediaItem[];
    metadata?: Record<string, any>;
    categories?: string[];
    intent?: string;
    serviceInfo?: ServiceInfo;
    isServicePost?: boolean;
}
export interface PostAnalysis {
    intent?: string;
    confidence?: number;
    categories: string[];
    suggestedActions: SuggestedAction[];
}
export interface FeedOptions {
    limit?: number;
    offset?: number;
    categoryId?: string;
    intent?: string;
    userId?: string;
    groupId?: string;
    startDate?: Date;
    endDate?: Date;
}
export interface FeedResult {
    posts: Post[];
    total: number;
    hasMore: boolean;
}
//# sourceMappingURL=social.types.d.ts.map