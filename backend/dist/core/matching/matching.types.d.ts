export type MatchType = 'exploration' | 'learning' | 'mirroring';
export interface MatchUser {
    userId: string;
    name: string;
    avatar?: string;
    state: string;
    affinity: {
        physical?: string[];
        learning?: string[];
        professional?: string[];
    };
    lastActivity?: string;
}
export interface MatchSuggestion {
    id: string;
    type: MatchType;
    users: MatchUser[];
    title: string;
    message: string;
    affinityScore: number;
    priority: number;
    createdAt: string;
}
export interface MatchResult {
    suggestions: MatchSuggestion[];
    hasMore: boolean;
}
//# sourceMappingURL=matching.types.d.ts.map