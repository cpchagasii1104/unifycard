export interface LearningCategory {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    level: number;
}
export interface LearningProfile {
    globalUserId: string;
    learnings: LearningCategory[];
    preferences: {
        [categoryId: string]: {
            details?: string[];
            notes?: string;
            progress?: 'beginner' | 'intermediate' | 'advanced' | null;
        };
    };
    metadata: Record<string, any>;
}
export interface UpdateLearningProfileInput {
    learnings?: string[];
    preferences?: {
        [categoryId: string]: {
            details?: string[];
            notes?: string;
            progress?: 'beginner' | 'intermediate' | 'advanced' | null;
        };
    };
    metadata?: Record<string, any>;
}
//# sourceMappingURL=profile-learning.types.d.ts.map