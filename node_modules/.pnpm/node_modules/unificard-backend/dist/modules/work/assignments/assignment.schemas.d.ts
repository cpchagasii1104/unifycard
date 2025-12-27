import { z } from 'zod';
export declare const createAssignmentSchema: z.ZodObject<{
    workerId: z.ZodString;
    agreedRate: z.ZodNumber;
    paymentType: z.ZodEnum<["fixed", "hourly"]>;
}, "strip", z.ZodTypeAny, {
    workerId: string;
    agreedRate: number;
    paymentType: "fixed" | "hourly";
}, {
    workerId: string;
    agreedRate: number;
    paymentType: "fixed" | "hourly";
}>;
export declare const updateAssignmentSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["assigned", "in_progress", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "completed" | "cancelled" | "in_progress" | "assigned" | undefined;
}, {
    status?: "completed" | "cancelled" | "in_progress" | "assigned" | undefined;
}>;
export declare const assignmentIdParamsSchema: z.ZodObject<{
    assignmentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    assignmentId: string;
}, {
    assignmentId: string;
}>;
export declare const jobIdParamsSchema: z.ZodObject<{
    jobId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobId: string;
}, {
    jobId: string;
}>;
export declare const listAssignmentsQuerySchema: z.ZodObject<{
    jobId: z.ZodOptional<z.ZodString>;
    workerId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["assigned", "in_progress", "completed", "cancelled"]>>;
    limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
    offset: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    jobId?: string | undefined;
    workerId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    status?: "completed" | "cancelled" | "in_progress" | "assigned" | undefined;
}, {
    jobId?: string | undefined;
    workerId?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
    status?: "completed" | "cancelled" | "in_progress" | "assigned" | undefined;
}>;
export declare const completeAssignmentBodySchema: z.ZodObject<{
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    qualityRating: z.ZodOptional<z.ZodNumber>;
    punctualityRating: z.ZodOptional<z.ZodNumber>;
    professionalismRating: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    rating: number;
    qualityRating?: number | undefined;
    punctualityRating?: number | undefined;
    professionalismRating?: number | undefined;
    comment?: string | undefined;
}, {
    rating: number;
    qualityRating?: number | undefined;
    punctualityRating?: number | undefined;
    professionalismRating?: number | undefined;
    comment?: string | undefined;
}>;
//# sourceMappingURL=assignment.schemas.d.ts.map