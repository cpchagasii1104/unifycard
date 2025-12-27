"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listJobsQuerySchema = exports.jobIdParamsSchema = exports.updateJobSchema = exports.createJobSchema = void 0;
// backend/src/modules/work/jobs/job.schemas.ts
const zod_1 = require("zod");
exports.createJobSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(5000),
    requiredSkills: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    budgetMin: zod_1.z.number().nonnegative().optional(),
    budgetMax: zod_1.z.number().nonnegative().optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
    location: zod_1.z
        .object({
        latitude: zod_1.z.number().min(-90).max(90),
        longitude: zod_1.z.number().min(-180).max(180),
    })
        .optional(),
});
exports.updateJobSchema = zod_1.z.object({
    title: zod_1.z.string().max(200).optional(),
    description: zod_1.z.string().max(5000).optional(),
    budgetMin: zod_1.z.number().nonnegative().optional(),
    budgetMax: zod_1.z.number().nonnegative().optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']).optional(),
});
exports.jobIdParamsSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid(),
});
exports.listJobsQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    status: zod_1.z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']).optional(),
    requiredSkill: zod_1.z.string().uuid().optional(),
    minBudget: zod_1.z.string().transform(v => (v ? Number(v) : undefined)).optional(),
    maxBudget: zod_1.z.string().transform(v => (v ? Number(v) : undefined)).optional(),
    lat: zod_1.z.string().transform(v => (v ? Number(v) : undefined)).optional(),
    lng: zod_1.z.string().transform(v => (v ? Number(v) : undefined)).optional(),
    radiusKm: zod_1.z.string().transform(v => (v ? Number(v) : undefined)).optional(),
    limit: zod_1.z.string().transform(v => (v ? parseInt(v) : 20)).optional(),
    offset: zod_1.z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});
//# sourceMappingURL=job.schemas.js.map