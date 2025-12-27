import { z } from 'zod';
export declare const createEventSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startTime: z.ZodEffects<z.ZodString, Date, string>;
    endTime: z.ZodEffects<z.ZodString, Date, string>;
    cityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    countryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    startTime: Date;
    endTime: Date;
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    description?: string | null | undefined;
}, {
    title: string;
    startTime: string;
    endTime: string;
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    description?: string | null | undefined;
}>, {
    title: string;
    startTime: Date;
    endTime: Date;
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    description?: string | null | undefined;
}, {
    title: string;
    startTime: string;
    endTime: string;
    countryId?: string | null | undefined;
    stateId?: string | null | undefined;
    cityId?: string | null | undefined;
    description?: string | null | undefined;
}>;
export declare const addSessionSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    startTime: z.ZodEffects<z.ZodString, Date, string>;
    endTime: z.ZodEffects<z.ZodString, Date, string>;
}, "strip", z.ZodTypeAny, {
    name: string;
    startTime: Date;
    endTime: Date;
}, {
    name: string;
    startTime: string;
    endTime: string;
}>, {
    name: string;
    startTime: Date;
    endTime: Date;
}, {
    name: string;
    startTime: string;
    endTime: string;
}>;
export declare const assignStaffSchema: z.ZodObject<{
    globalUserId: z.ZodString;
    role: z.ZodString;
}, "strip", z.ZodTypeAny, {
    globalUserId: string;
    role: string;
}, {
    globalUserId: string;
    role: string;
}>;
export declare const checkInSchema: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>;
//# sourceMappingURL=events.schemas.d.ts.map