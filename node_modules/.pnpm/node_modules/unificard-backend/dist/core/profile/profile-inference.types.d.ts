export type UserState = 'explorer' | 'curious' | 'in_transition' | 'professional_training' | 'professional_stable' | 'at_risk';
export interface CategoryAffinity {
    physicalCategory: string;
    learningCategories: string[];
    professionalCategories: string[];
}
export interface InferenceRule {
    id: string;
    name: string;
    description: string;
    condition: (profile: UserProfileSnapshot) => boolean;
    suggestion: (profile: UserProfileSnapshot) => InferenceSuggestion | null;
    priority: number;
}
export interface UserProfileSnapshot {
    physical: {
        interests: Array<{
            categoryId: string;
            categoryName: string;
            categoryPath: string[];
        }>;
        count: number;
    };
    learning: {
        learnings: Array<{
            categoryId: string;
            categoryName: string;
            categoryPath: string[];
            progress?: 'beginner' | 'intermediate' | 'advanced' | null;
        }>;
        count: number;
        hasIntermediateOrAdvanced: boolean;
    };
    professional: {
        skills: Array<{
            categoryId: string;
            categoryName: string;
            categoryPath: string[];
        }>;
        count: number;
    };
    lastUpdated: {
        physical?: string;
        learning?: string;
        professional?: string;
    };
}
export interface InferenceSuggestion {
    id: string;
    type: 'physical_to_learning' | 'learning_to_professional' | 'professional_needs_physical' | 'learning_stagnant';
    title: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
    categoryId?: string;
    categoryName?: string;
    categoryPath?: string[];
    priority: number;
    dismissible: boolean;
    shownCount?: number;
    lastShown?: string;
}
export interface InferenceResult {
    userState: UserState;
    suggestions: InferenceSuggestion[];
    insights: {
        hasPhysicalWithoutLearning: boolean;
        hasLearningWithoutProfessional: boolean;
        hasProfessionalWithoutPhysical: boolean;
        learningStagnant: boolean;
    };
}
//# sourceMappingURL=profile-inference.types.d.ts.map