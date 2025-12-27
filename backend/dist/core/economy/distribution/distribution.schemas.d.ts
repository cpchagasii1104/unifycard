import { z } from 'zod';
export declare const feeConfigSchema: z.ZodObject<{
    platformFeePercent: z.ZodOptional<z.ZodNumber>;
    communityFeePercent: z.ZodOptional<z.ZodNumber>;
    groupFeePercent: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    platformFeePercent?: number | undefined;
    communityFeePercent?: number | undefined;
    groupFeePercent?: number | undefined;
}, {
    platformFeePercent?: number | undefined;
    communityFeePercent?: number | undefined;
    groupFeePercent?: number | undefined;
}>;
export declare const autoDistributeSchema: z.ZodObject<{
    fromAccount: z.ZodString;
    toAccount: z.ZodString;
    amount: z.ZodNumber;
    groupAccount: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        platformFeePercent: z.ZodOptional<z.ZodNumber>;
        communityFeePercent: z.ZodOptional<z.ZodNumber>;
        groupFeePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    fromAccount: string;
    toAccount: string;
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
    groupAccount?: string | undefined;
}, {
    amount: number;
    fromAccount: string;
    toAccount: string;
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
    groupAccount?: string | undefined;
}>;
export declare const simulateSchema: z.ZodObject<{
    amount: z.ZodNumber;
    config: z.ZodOptional<z.ZodObject<{
        platformFeePercent: z.ZodOptional<z.ZodNumber>;
        communityFeePercent: z.ZodOptional<z.ZodNumber>;
        groupFeePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
}, {
    amount: number;
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
}>;
export declare const batchCalculateSchema: z.ZodObject<{
    amounts: z.ZodArray<z.ZodNumber, "many">;
    config: z.ZodOptional<z.ZodObject<{
        platformFeePercent: z.ZodOptional<z.ZodNumber>;
        communityFeePercent: z.ZodOptional<z.ZodNumber>;
        groupFeePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }, {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    amounts: number[];
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
}, {
    amounts: number[];
    config?: {
        platformFeePercent?: number | undefined;
        communityFeePercent?: number | undefined;
        groupFeePercent?: number | undefined;
    } | undefined;
}>;
export type AutoDistributeInput = z.infer<typeof autoDistributeSchema>;
export type FeeConfigInput = z.infer<typeof feeConfigSchema>;
//# sourceMappingURL=distribution.schemas.d.ts.map