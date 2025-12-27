export type FeedContentType = 'pleasure' | 'learning' | 'transition' | 'human';
export interface FeedContent {
    id: string;
    type: FeedContentType;
    title: string;
    description?: string;
    author?: {
        id: string;
        name: string;
        avatar?: string;
    };
    metadata?: {
        categoryId?: string;
        categoryName?: string;
        tags?: string[];
        estimatedReadTime?: number;
    };
    createdAt: string;
    priority: number;
}
export interface FeedSection {
    id: string;
    title: string;
    subtitle?: string;
    contentType: FeedContentType;
    contents: FeedContent[];
    priority: number;
}
export interface FeedContextual {
    userState: string;
    contextHeader?: string;
    sections: FeedSection[];
    hasMore: boolean;
}
//# sourceMappingURL=feed.types.d.ts.map