import { z } from 'zod';
export declare const createReviewSchema: z.ZodObject<{
    entityType: z.ZodString;
    entityId: z.ZodString;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    qualityRating: z.ZodOptional<z.ZodNumber>;
    punctualityRating: z.ZodOptional<z.ZodNumber>;
    professionalismRating: z.ZodOptional<z.ZodNumber>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    entityType: string;
    entityId: string;
    rating: number;
    context?: Record<string, any> | undefined;
    qualityRating?: number | undefined;
    punctualityRating?: number | undefined;
    professionalismRating?: number | undefined;
    comment?: string | undefined;
}, {
    entityType: string;
    entityId: string;
    rating: number;
    context?: Record<string, any> | undefined;
    qualityRating?: number | undefined;
    punctualityRating?: number | undefined;
    professionalismRating?: number | undefined;
    comment?: string | undefined;
}>;
export declare const reviewIdParamsSchema: z.ZodObject<{
    reviewId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reviewId: string;
}, {
    reviewId: string;
}>;
export declare const listReviewsQuerySchema: z.ZodObject<{
    entityType: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    authorUserId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
    offset: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    entityType?: string | undefined;
    entityId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    authorUserId?: string | undefined;
}, {
    entityType?: string | undefined;
    entityId?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
    authorUserId?: string | undefined;
}>;
//# sourceMappingURL=review.schemas.d.ts.map