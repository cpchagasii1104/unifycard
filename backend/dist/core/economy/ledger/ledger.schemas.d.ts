import { z } from 'zod';
export declare const accountIdSchema: z.ZodObject<{
    accountId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accountId: string;
}, {
    accountId: string;
}>;
export declare const transactionIdSchema: z.ZodObject<{
    transactionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    transactionId: string;
}, {
    transactionId: string;
}>;
export declare const ledgerQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    entryType: z.ZodOptional<z.ZodEnum<["credit", "debit"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    entryType?: "credit" | "debit" | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    entryType?: "credit" | "debit" | undefined;
}>;
export declare const summaryQuerySchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
//# sourceMappingURL=ledger.schemas.d.ts.map