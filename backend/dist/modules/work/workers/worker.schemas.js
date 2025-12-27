"use strict";
// backend/src/modules/work/workers/worker.schemas.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWorkersQuerySchema = exports.workerIdParamsSchema = exports.updateWorkerSchema = exports.createWorkerSchema = exports.availabilitySchema = exports.locationSchema = void 0;
const zod_1 = require("zod");
exports.locationSchema = zod_1.z.object({
    latitude: zod_1.z
        .number({
        required_error: 'Latitude is required',
        invalid_type_error: 'Latitude must be a number',
    })
        .min(-90, 'Latitude must be >= -90')
        .max(90, 'Latitude must be <= 90'),
    longitude: zod_1.z
        .number({
        required_error: 'Longitude is required',
        invalid_type_error: 'Longitude must be a number',
    })
        .min(-180, 'Longitude must be >= -180')
        .max(180, 'Longitude must be <= 180'),
});
exports.availabilitySchema = zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string()));
exports.createWorkerSchema = zod_1.z.object({
    bio: zod_1.z
        .string()
        .min(1, 'Bio must not be empty')
        .max(2000, 'Bio must be at most 2000 characters')
        .optional(),
    hourlyRate: zod_1.z
        .number()
        .nonnegative('Hourly rate must be >= 0')
        .max(1_000_000, 'Hourly rate is too high')
        .optional(),
    location: exports.locationSchema.optional(),
    availability: exports.availabilitySchema.optional(),
});
exports.updateWorkerSchema = zod_1.z.object({
    bio: zod_1.z
        .string()
        .min(1, 'Bio must not be empty')
        .max(2000, 'Bio must be at most 2000 characters')
        .optional(),
    hourlyRate: zod_1.z
        .number()
        .nonnegative('Hourly rate must be >= 0')
        .max(1_000_000, 'Hourly rate is too high')
        .optional(),
    location: exports.locationSchema.optional(),
    availability: exports.availabilitySchema.optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.workerIdParamsSchema = zod_1.z.object({
    workerId: zod_1.z.string().uuid('Invalid worker ID format'),
});
exports.listWorkersQuerySchema = zod_1.z.object({
    skillId: zod_1.z.string().uuid('Invalid skill ID format').optional(),
    isActive: zod_1.z
        .union([zod_1.z.literal('true'), zod_1.z.literal('false')])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === 'true')),
    minReputation: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number(v)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0 && v <= 5), 'minReputation must be between 0 and 5'),
    lat: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number(v)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v >= -90 && v <= 90), 'lat must be between -90 and 90'),
    lng: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number(v)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v >= -180 && v <= 180), 'lng must be between -180 and 180'),
    radiusKm: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number(v)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v > 0), 'radiusKm must be > 0'),
    limit: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 1 && v <= 100), 'limit must be between 1 and 100'),
    offset: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))
        .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), 'offset must be >= 0'),
});
//# sourceMappingURL=worker.schemas.js.map