import { z } from 'zod';
export declare const sendMessageSchema: z.ZodObject<{
    text: z.ZodString;
    targetGlobalUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    targetCompanyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    sessionId?: string | null | undefined;
    targetGlobalUserId?: string | null | undefined;
    targetCompanyId?: string | null | undefined;
}, {
    text: string;
    sessionId?: string | null | undefined;
    targetGlobalUserId?: string | null | undefined;
    targetCompanyId?: string | null | undefined;
}>;
//# sourceMappingURL=care.schemas.d.ts.map