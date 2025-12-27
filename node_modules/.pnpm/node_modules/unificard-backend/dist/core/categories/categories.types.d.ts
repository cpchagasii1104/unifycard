import { CategoryContext, CategoryStatus } from '@unificard/contracts';
export interface Category {
    categoryId: string;
    parentId: string | null;
    name: string;
    slug: string;
    description: string | null;
    level: number;
    path: string[];
    keywords: string[];
    countryCode: string | null;
    status?: CategoryStatus;
    requiresReview?: boolean;
    createdByAI?: boolean;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    rejectionReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface CategoryRow {
    category_id: string;
    parent_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    level: number;
    path: string[];
    keywords: string[] | null;
    country_code: string | null;
    status?: CategoryStatus;
    requires_review?: boolean;
    created_by_ai?: boolean;
    approved_by?: string | null;
    approved_at?: Date | null;
    rejection_reason?: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CategoryTree extends Category {
    children?: CategoryTree[];
}
export interface CreateCategoryInput {
    name: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
    keywords?: string[];
    countryCode?: string | null;
    allowActive?: boolean;
    createdBy?: {
        userId?: string;
        actorId?: string;
        tenantId?: string;
        source: 'manual' | 'script' | 'ai' | 'migration';
    };
}
export interface CreateManyCategoriesInput {
    categories: Array<{
        name: string;
        slug?: string;
        description?: string | null;
        parentSlug?: string | null;
    }>;
}
export interface AssignCategoryToCompanyInput {
    companyId: string;
    categoryId: string;
}
export interface AssignSkillToUserInput {
    categoryId: string;
    skillLevel?: number;
    yearsExperience?: number;
    hourlyRate?: number | null;
}
export interface ClassifyTextInput {
    text: string;
    maxCategories?: number;
}
export interface CategoryClassification {
    categoryId: string;
    categoryName: string;
    confidence: number;
    path: string[];
}
export interface AICreateCategoryInput {
    text: string;
    context?: CategoryContext;
    parentId?: string | null;
    countryCode?: string | null;
    tenantId?: string;
    actorId?: string;
    globalUserId?: string;
    inputType?: 'text' | 'voice' | 'transcription';
    audioUrl?: string;
    audioHash?: string;
}
export interface AICreateCategoryResult {
    created: boolean;
    category?: Category;
    existingCategory?: Category;
    message: string;
    suggestedParent?: {
        categoryId: string;
        name: string;
        path: string[];
    } | null;
    requiresApproval: boolean;
}
/**
 * Resultado da sugestão de caminho hierárquico pela IA
 * IA atua como CLASSIFICADORA, não criadora
 */
export interface CategoryAutocompleteResult {
    id: string;
    name: string;
    slug: string;
    level: number;
    path: string[];
    fullPathLabel: string;
}
export interface CategoryPathSuggestion {
    normalizedInput: string;
    suggestedRoot: {
        id: string;
        name: string;
        slug: string;
        path: string[];
    } | null;
    suggestedParent: {
        id: string;
        name: string;
        slug: string;
        path: string[];
        level: number;
    } | null;
    leafName: string;
    leafDescription: string | null;
    confidence: number;
    reasoning: string;
    requiresReview: boolean;
    keywords?: string[];
}
//# sourceMappingURL=categories.types.d.ts.map