import { z } from 'zod';
export declare const updateRootConfigSchema: z.ZodObject<{
    countryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timezone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | null | undefined;
    languages?: string[] | undefined;
}, {
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | null | undefined;
    languages?: string[] | undefined;
}>;
export declare const setRegionSchema: z.ZodObject<{
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
export declare const setLanguagesSchema: z.ZodObject<{
    languages: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    languages: string[];
}, {
    languages: string[];
}>;
export declare const setTimezoneSchema: z.ZodObject<{
    timezone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timezone: string;
}, {
    timezone: string;
}>;
export declare const setCurrencySchema: z.ZodObject<{
    currency: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currency: string;
}, {
    currency: string;
}>;
//# sourceMappingURL=root-config.schemas.d.ts.map