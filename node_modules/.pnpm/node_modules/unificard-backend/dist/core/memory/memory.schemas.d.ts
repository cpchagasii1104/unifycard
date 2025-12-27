import { z } from 'zod';
export declare const updateFromIntentSchema: z.ZodObject<{
    intent: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    entityType: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    entityName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    intent: string;
    parameters: Record<string, any>;
    entityType?: string | undefined;
    entityId?: string | undefined;
    entityName?: string | undefined;
}, {
    intent: string;
    parameters: Record<string, any>;
    entityType?: string | undefined;
    entityId?: string | undefined;
    entityName?: string | undefined;
}>;
export declare const registerInteractionSchema: z.ZodObject<{
    entityId: z.ZodString;
    entityType: z.ZodString;
    entityName: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    entityType: string;
    entityId: string;
    entityName?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    entityType: string;
    entityId: string;
    entityName?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>;
//# sourceMappingURL=memory.schemas.d.ts.map