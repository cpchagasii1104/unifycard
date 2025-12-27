import { z } from 'zod';
/**
 * Schema para criar transferência
 */
export declare const createTransferSchema: z.ZodObject<{
    fromAccount: z.ZodString;
    toAccount: z.ZodString;
    amount: z.ZodNumber;
    eventId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    fromAccount: string;
    toAccount: string;
    metadata?: Record<string, any> | undefined;
    eventId?: string | undefined;
}, {
    amount: number;
    fromAccount: string;
    toAccount: string;
    metadata?: Record<string, any> | undefined;
    eventId?: string | undefined;
}>;
/**
 * Schema para validar transaction ID
 */
export declare const transactionIdSchema: z.ZodObject<{
    transactionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    transactionId: string;
}, {
    transactionId: string;
}>;
/**
 * Schema para validar event ID
 */
export declare const eventIdSchema: z.ZodObject<{
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId: string;
}, {
    eventId: string;
}>;
/**
 * Schema para validar account ID
 */
export declare const accountIdSchema: z.ZodObject<{
    accountId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accountId: string;
}, {
    accountId: string;
}>;
/**
 * Schema para query params de listagem
 */
export declare const listTransactionsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
}>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
//# sourceMappingURL=transaction.schemas.d.ts.map