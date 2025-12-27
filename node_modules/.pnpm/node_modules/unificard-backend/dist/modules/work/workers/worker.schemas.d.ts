import { z } from 'zod';
export declare const locationSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
}, {
    latitude: number;
    longitude: number;
}>;
export declare const availabilitySchema: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
export declare const createWorkerSchema: z.ZodObject<{
    bio: z.ZodOptional<z.ZodString>;
    hourlyRate: z.ZodOptional<z.ZodNumber>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
    }, {
        latitude: number;
        longitude: number;
    }>>;
    availability: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    hourlyRate?: number | undefined;
    bio?: string | undefined;
    availability?: Record<string, string[]> | undefined;
}, {
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    hourlyRate?: number | undefined;
    bio?: string | undefined;
    availability?: Record<string, string[]> | undefined;
}>;
export declare const updateWorkerSchema: z.ZodObject<{
    bio: z.ZodOptional<z.ZodString>;
    hourlyRate: z.ZodOptional<z.ZodNumber>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
    }, {
        latitude: number;
        longitude: number;
    }>>;
    availability: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    isActive?: boolean | undefined;
    hourlyRate?: number | undefined;
    bio?: string | undefined;
    availability?: Record<string, string[]> | undefined;
}, {
    location?: {
        latitude: number;
        longitude: number;
    } | undefined;
    isActive?: boolean | undefined;
    hourlyRate?: number | undefined;
    bio?: string | undefined;
    availability?: Record<string, string[]> | undefined;
}>;
export declare const workerIdParamsSchema: z.ZodObject<{
    workerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workerId: string;
}, {
    workerId: string;
}>;
export declare const listWorkersQuerySchema: z.ZodObject<{
    skillId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"true">, z.ZodLiteral<"false">]>>, boolean | undefined, "true" | "false" | undefined>;
    minReputation: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
    lat: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
    lng: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
    radiusKm: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
    limit: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
    offset: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>, number | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
    isActive?: boolean | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    radiusKm?: number | undefined;
    skillId?: string | undefined;
    minReputation?: number | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    isActive?: "true" | "false" | undefined;
    lat?: string | undefined;
    lng?: string | undefined;
    radiusKm?: string | undefined;
    skillId?: string | undefined;
    minReputation?: string | undefined;
}>;
//# sourceMappingURL=worker.schemas.d.ts.map