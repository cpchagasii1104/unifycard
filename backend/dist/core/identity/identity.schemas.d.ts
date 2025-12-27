import { z } from 'zod';
export declare const updateGlobalIdentitySchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    birthdate: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNull, z.ZodLiteral<"">]>, string | null, string | null>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    metadata?: Record<string, any> | undefined;
    fullName?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    birthdate?: string | null | undefined;
}, {
    metadata?: Record<string, any> | undefined;
    fullName?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    birthdate?: string | null | undefined;
}>;
//# sourceMappingURL=identity.schemas.d.ts.map