import { z } from 'zod';
export declare const configKeySchema: z.ZodObject<{
    module: z.ZodString;
    key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    module: string;
    key: string;
}, {
    module: string;
    key: string;
}>;
export declare const setConfigSchema: z.ZodObject<{
    module: z.ZodString;
    key: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>;
    isSystem: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    module: string;
    key: string;
    value: string | number | boolean | any[] | Record<string, any>;
    isSystem?: boolean | undefined;
}, {
    module: string;
    key: string;
    value: string | number | boolean | any[] | Record<string, any>;
    isSystem?: boolean | undefined;
}>;
export declare const listConfigsQuerySchema: z.ZodObject<{
    module: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
    module?: string | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    module?: string | undefined;
}>;
export declare const flagNameSchema: z.ZodObject<{
    flagName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    flagName: string;
}, {
    flagName: string;
}>;
export declare const upsertFlagSchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    rolloutPercentage: z.ZodOptional<z.ZodNumber>;
    userWhitelist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    enabled?: boolean | undefined;
    rolloutPercentage?: number | undefined;
    userWhitelist?: string[] | undefined;
}, {
    description?: string | undefined;
    enabled?: boolean | undefined;
    rolloutPercentage?: number | undefined;
    userWhitelist?: string[] | undefined;
}>;
export declare const checkFlagQuerySchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
}, {
    userId?: string | undefined;
}>;
export declare const listFlagsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
}>;
export type SetConfigInput = z.infer<typeof setConfigSchema>;
export type UpsertFlagInput = z.infer<typeof upsertFlagSchema>;
//# sourceMappingURL=config.schemas.d.ts.map