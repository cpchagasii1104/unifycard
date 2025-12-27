import { z } from 'zod';
export declare const setResidenceSchema: z.ZodObject<{
    countryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timezone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | undefined;
    languages?: string[] | undefined;
}, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | undefined;
    languages?: string[] | undefined;
}>;
export declare const setResidencePreferencesSchema: z.ZodObject<{
    timezone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    timezone?: string | null | undefined;
    currency?: string | undefined;
    languages?: string[] | undefined;
}, {
    timezone?: string | null | undefined;
    currency?: string | undefined;
    languages?: string[] | undefined;
}>;
//# sourceMappingURL=residence.schemas.d.ts.map