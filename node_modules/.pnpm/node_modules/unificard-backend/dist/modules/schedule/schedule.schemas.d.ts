import { z } from 'zod';
export declare const createScheduleSchema: z.ZodEffects<z.ZodObject<{
    globalUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    companyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    globalUserId?: string | null | undefined;
    metadata?: Record<string, any> | undefined;
    serviceId?: string | null | undefined;
    companyId?: string | null | undefined;
}, {
    globalUserId?: string | null | undefined;
    metadata?: Record<string, any> | undefined;
    serviceId?: string | null | undefined;
    companyId?: string | null | undefined;
}>, {
    globalUserId?: string | null | undefined;
    metadata?: Record<string, any> | undefined;
    serviceId?: string | null | undefined;
    companyId?: string | null | undefined;
}, {
    globalUserId?: string | null | undefined;
    metadata?: Record<string, any> | undefined;
    serviceId?: string | null | undefined;
    companyId?: string | null | undefined;
}>;
export declare const addSlotSchema: z.ZodEffects<z.ZodObject<{
    startTime: z.ZodEffects<z.ZodString, Date, string>;
    endTime: z.ZodEffects<z.ZodString, Date, string>;
    status: z.ZodOptional<z.ZodEnum<["available", "reserved", "blocked"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    startTime: Date;
    endTime: Date;
    metadata?: Record<string, any> | undefined;
    status?: "available" | "reserved" | "blocked" | undefined;
}, {
    startTime: string;
    endTime: string;
    metadata?: Record<string, any> | undefined;
    status?: "available" | "reserved" | "blocked" | undefined;
}>, {
    startTime: Date;
    endTime: Date;
    metadata?: Record<string, any> | undefined;
    status?: "available" | "reserved" | "blocked" | undefined;
}, {
    startTime: string;
    endTime: string;
    metadata?: Record<string, any> | undefined;
    status?: "available" | "reserved" | "blocked" | undefined;
}>;
export declare const reserveSlotSchema: z.ZodObject<{
    slotId: z.ZodString;
    actionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    slotId: string;
    metadata?: Record<string, any> | undefined;
    actionId?: string | undefined;
}, {
    slotId: string;
    metadata?: Record<string, any> | undefined;
    actionId?: string | undefined;
}>;
export declare const slotStatusSchema: z.ZodEnum<["available", "reserved", "blocked"]>;
//# sourceMappingURL=schedule.schemas.d.ts.map