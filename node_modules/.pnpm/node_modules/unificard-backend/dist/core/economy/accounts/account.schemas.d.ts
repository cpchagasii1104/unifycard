import { z } from 'zod';
/**
 * Schema para criar conta
 */
export declare const createAccountSchema: z.ZodObject<{
    ownerId: z.ZodString;
    ownerType: z.ZodEnum<["user", "merchant", "community_fund", "platform_ops", "group"]>;
    currency: z.ZodOptional<z.ZodEnum<["BRL", "USD", "EUR", "TEST"]>>;
}, "strip", z.ZodTypeAny, {
    ownerId: string;
    ownerType: "user" | "merchant" | "community_fund" | "platform_ops" | "group";
    currency?: "BRL" | "USD" | "EUR" | "TEST" | undefined;
}, {
    ownerId: string;
    ownerType: "user" | "merchant" | "community_fund" | "platform_ops" | "group";
    currency?: "BRL" | "USD" | "EUR" | "TEST" | undefined;
}>;
/**
 * Schema para validar UUID nos params
 */
export declare const accountIdSchema: z.ZodObject<{
    accountId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accountId: string;
}, {
    accountId: string;
}>;
/**
 * Schema para validar owner ID nos params
 */
export declare const ownerIdSchema: z.ZodObject<{
    ownerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ownerId: string;
}, {
    ownerId: string;
}>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
//# sourceMappingURL=account.schemas.d.ts.map