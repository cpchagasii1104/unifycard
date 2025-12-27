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
export declare const suggestedActionSchema: z.ZodObject<{
    action: z.ZodString;
    module: z.ZodString;
    endpoint: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    module: string;
    description: string;
    action: string;
    payload?: Record<string, any> | undefined;
    endpoint?: string | undefined;
}, {
    module: string;
    description: string;
    action: string;
    payload?: Record<string, any> | undefined;
    endpoint?: string | undefined;
}>;
export declare const createPostSchema: z.ZodObject<{
    content: z.ZodString;
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
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: string;
    intent?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    categories?: string[] | undefined;
}, {
    content: string;
    intent?: string | undefined;
    metadata?: Record<string, any> | undefined;
    media?: {
        url: string;
        type: "image" | "video" | "audio";
        metadata?: Record<string, any> | undefined;
        duration?: number | undefined;
        thumbnailUrl?: string | undefined;
    }[] | undefined;
    categories?: string[] | undefined;
}>;
export declare const feedOptionsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    categoryId: z.ZodOptional<z.ZodString>;
    intent: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    intent?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    categoryId?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    userId?: string | undefined;
    intent?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    categoryId?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
//# sourceMappingURL=social.schemas.d.ts.map