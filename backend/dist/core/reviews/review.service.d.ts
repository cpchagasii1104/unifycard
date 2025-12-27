import type { Review, CreateReviewInput, ListReviewsFilters } from './review.types';
declare class ReviewService {
    private toReview;
    getById(tenantId: string, reviewId: string): Promise<Review | null>;
    createReview(tenantId: string, authorUserId: string, sourceModule: string, input: CreateReviewInput): Promise<Review>;
    listReviews(tenantId: string, filters: ListReviewsFilters): Promise<{
        reviews: Review[];
        total: number;
    }>;
}
export declare const reviewService: ReviewService;
export {};
//# sourceMappingURL=review.service.d.ts.map