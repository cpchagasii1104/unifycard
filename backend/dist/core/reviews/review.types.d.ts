export type ReviewEntityType = 'worker' | 'client_user' | 'company' | 'service' | 'driver' | 'restaurant' | 'product';
export interface ReviewRow {
    review_id: string;
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    author_user_id: string;
    author_global_user_id: string | null;
    source_module: string;
    rating: number;
    comment: string | null;
    quality_rating: number | null;
    punctuality_rating: number | null;
    professionalism_rating: number | null;
    context: any | null;
    created_at: string;
    updated_at: string;
}
export interface Review {
    reviewId: string;
    tenantId: string;
    entityType: ReviewEntityType | string;
    entityId: string;
    authorUserId: string;
    authorGlobalUserId?: string | null;
    sourceModule: string;
    rating: number;
    comment?: string;
    qualityRating?: number;
    punctualityRating?: number;
    professionalismRating?: number;
    context?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
export interface CreateReviewInput {
    entityType: ReviewEntityType | string;
    entityId: string;
    rating: number;
    comment?: string;
    qualityRating?: number;
    punctualityRating?: number;
    professionalismRating?: number;
    context?: Record<string, any>;
}
export interface ListReviewsFilters {
    entityType?: string;
    entityId?: string;
    authorUserId?: string;
    limit?: number;
    offset?: number;
}
//# sourceMappingURL=review.types.d.ts.map