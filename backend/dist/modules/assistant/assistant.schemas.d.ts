import { z } from 'zod';
export declare const assistantChannelSchema: z.ZodEnum<["chat", "social", "voice"]>;
export declare const assistantTargetTypeSchema: z.ZodEnum<["user", "company", "global"]>;
export declare const sendAssistantMessageSchema: z.ZodObject<{
    text: z.ZodString;
    channel: z.ZodOptional<z.ZodEnum<["chat", "social", "voice"]>>;
    targetType: z.ZodOptional<z.ZodEnum<["user", "company", "global"]>>;
    targetGlobalUserId: z.ZodOptional<z.ZodString>;
    targetCompanyId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    channel?: "voice" | "social" | "chat" | undefined;
    sessionId?: string | undefined;
    targetGlobalUserId?: string | undefined;
    targetCompanyId?: string | undefined;
    targetType?: "user" | "company" | "global" | undefined;
}, {
    text: string;
    channel?: "voice" | "social" | "chat" | undefined;
    sessionId?: string | undefined;
    targetGlobalUserId?: string | undefined;
    targetCompanyId?: string | undefined;
    targetType?: "user" | "company" | "global" | undefined;
}>;
//# sourceMappingURL=assistant.schemas.d.ts.map