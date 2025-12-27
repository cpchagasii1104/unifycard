import { z } from 'zod';
export declare const countryCodeSchema: z.ZodString;
export declare const stateCodeSchema: z.ZodString;
export declare const cityNameSchema: z.ZodString;
export declare const getStatesByCountryParamsSchema: z.ZodObject<{
    countryId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    countryId: string;
}, {
    countryId: string;
}>;
export declare const getCitiesByStateParamsSchema: z.ZodObject<{
    stateId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    stateId: string;
}, {
    stateId: string;
}>;
export declare const searchCitiesQuerySchema: z.ZodObject<{
    term: z.ZodString;
    countryId: z.ZodOptional<z.ZodString>;
    stateId: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    term: string;
    countryId?: string | undefined;
    stateId?: string | undefined;
}, {
    term: string;
    countryId?: string | undefined;
    stateId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
//# sourceMappingURL=world.schemas.d.ts.map