import { z } from 'zod';
export declare const createApplicationSchema: z.ZodObject<{
    proposedRate: z.ZodNumber;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    proposedRate: number;
    message?: string | undefined;
}, {
    proposedRate: number;
    message?: string | undefined;
}>;
export declare const updateApplicationSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "accepted", "rejected", "withdrawn"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "rejected" | "accepted" | "withdrawn" | undefined;
}, {
    status?: "pending" | "rejected" | "accepted" | "withdrawn" | undefined;
}>;
export declare const applicationIdParamsSchema: z.ZodObject<{
    applicationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    applicationId: string;
}, {
    applicationId: string;
}>;
export declare const jobIdParamsSchema: z.ZodObject<{
    jobId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobId: string;
}, {
    jobId: string;
}>;
export declare const listApplicationsQuerySchema: z.ZodObject<{
    jobId: z.ZodOptional<z.ZodString>;
    workerId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "accepted", "rejected", "withdrawn"]>>;
    limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
    offset: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    jobId?: string | undefined;
    workerId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    status?: "pending" | "rejected" | "accepted" | "withdrawn" | undefined;
}, {
    jobId?: string | undefined;
    workerId?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
    status?: "pending" | "rejected" | "accepted" | "withdrawn" | undefined;
}>;
//# sourceMappingURL=application.schemas.d.ts.map