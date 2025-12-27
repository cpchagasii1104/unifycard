import { z } from 'zod';
export declare const setTenantRegionSchema: z.ZodObject<{
    countryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
}, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
}>;
//# sourceMappingURL=tenant.schemas.d.ts.map