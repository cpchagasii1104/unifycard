import { z } from 'zod';
export declare const createActionSchema: z.ZodObject<{
    postId: z.ZodString;
    intent: z.ZodString;
    confidence: z.ZodOptional<z.ZodNumber>;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    intent: string;
    parameters: Record<string, any>;
    postId: string;
    confidence?: number | undefined;
}, {
    intent: string;
    parameters: Record<string, any>;
    postId: string;
    confidence?: number | undefined;
}>;
export declare const executeActionSchema: z.ZodObject<{
    actionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actionId: string;
}, {
    actionId: string;
}>;
export declare const actionStatusSchema: z.ZodEnum<["available", "executed", "failed", "cancelled"]>;
//# sourceMappingURL=social-actions.schemas.d.ts.map