import { z } from 'zod';
export declare const mediaItemSchema: z.ZodObject<{
    type: z.ZodEnum<["image", "video", "audio"]>;
    url: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    type: "image" | "video" | "audio";
    metadata?: Record<string, any> | undefined;
    duration?: number | undefined;
    thumbnailUrl?: string | undefined;
}, {
    url: string;
    type: "image" | "video" | "audio";
    metadata?: Record<string, any> | undefined;
    duration?: number | undefined;
    thumbnailUrl?: string | undefined;
}>;
export declare const sendMessageSchema: z.ZodEffects<z.ZodObject<{
    conversationId: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    audioUrl: z.ZodOptional<z.ZodString>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["image", "video", "audio"]>;
        url: z.ZodString;
        thumbnailUrl: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }, {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    text?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    audioUrl?: string | undefined;
    conversationId?: string | undefined;
}, {
    text?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    audioUrl?: string | undefined;
    conversationId?: string | undefined;
}>, {
    text?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    audioUrl?: string | undefined;
    conversationId?: string | undefined;
}, {
    text?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    audioUrl?: string | undefined;
    conversationId?: string | undefined;
}>;
//# sourceMappingURL=social-chat.schemas.d.ts.map