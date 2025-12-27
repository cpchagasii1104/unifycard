export interface InterestCategory {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    level: number;
}
export interface LifestyleInfo {
    drinks: 'never' | 'socially' | 'regularly' | 'prefer_not_to_say' | null;
    smokes: 'never' | 'occasionally' | 'regularly' | 'prefer_not_to_say' | null;
    relationshipStatus: 'single' | 'dating' | 'in_relationship' | 'married' | 'prefer_not_to_say' | null;
    sexualOrientation: 'heterosexual' | 'homosexual' | 'bisexual' | 'pansexual' | 'asexual' | 'prefer_not_to_say' | null;
}
export interface PhysicalProfile {
    globalUserId: string;
    interests: InterestCategory[];
    lifestyle: LifestyleInfo;
    preferences: {
        [categoryId: string]: {
            details?: string[];
            notes?: string;
        };
    };
    metadata: Record<string, any>;
}
export interface UpdatePhysicalProfileInput {
    interests?: string[];
    lifestyle?: Partial<LifestyleInfo>;
    preferences?: {
        [categoryId: string]: {
            details?: string[];
            notes?: string;
        };
    };
    metadata?: Record<string, any>;
}
//# sourceMappingURL=profile-physical.types.d.ts.map