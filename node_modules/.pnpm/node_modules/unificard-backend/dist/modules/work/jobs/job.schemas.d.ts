import { z } from 'zod';
export declare const createJobSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    requiredSkills: z.ZodArray<z.ZodString, "many">;
    budgetMin: z.ZodOptional<z.ZodNumber>;
    budgetMax: z.ZodOptional<z.ZodNumber>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
    }, {
        latitude: number;
        longitude: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    requiredSkills: string[];
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    scheduledAt?: string | undefined;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
}, {
    title: string;
    description: string;
    requiredSkills: string[];
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    scheduledAt?: string | undefined;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
}>;
export declare const updateJobSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    budgetMin: z.ZodOptional<z.ZodNumber>;
    budgetMax: z.ZodOptional<z.ZodNumber>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "open", "in_progress", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    scheduledAt?: string | undefined;
    title?: string | undefined;
    status?: "completed" | "cancelled" | "draft" | "open" | "in_progress" | undefined;
    description?: string | undefined;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
}, {
    scheduledAt?: string | undefined;
    title?: string | undefined;
    status?: "completed" | "cancelled" | "draft" | "open" | "in_progress" | undefined;
    description?: string | undefined;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
}>;
export declare const jobIdParamsSchema: z.ZodObject<{
    jobId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobId: string;
}, {
    jobId: string;
}>;
export declare const listJobsQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "open", "in_progress", "completed", "cancelled"]>>;
    requiredSkill: z.ZodOptional<z.ZodString>;
    minBudget: z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>>;
    maxBudget: z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>>;
    lat: z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>>;
    lng: z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>>;
    radiusKm: z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>>;
    limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
    offset: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    status?: "completed" | "cancelled" | "draft" | "open" | "in_progress" | undefined;
    requiredSkill?: string | undefined;
    minBudget?: number | undefined;
    maxBudget?: number | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    radiusKm?: number | undefined;
}, {
    search?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
    status?: "completed" | "cancelled" | "draft" | "open" | "in_progress" | undefined;
    requiredSkill?: string | undefined;
    minBudget?: string | undefined;
    maxBudget?: string | undefined;
    lat?: string | undefined;
    lng?: string | undefined;
    radiusKm?: string | undefined;
}>;
//# sourceMappingURL=job.schemas.d.ts.map