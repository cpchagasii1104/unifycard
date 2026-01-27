"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApplicationsQuerySchema = exports.jobIdParamsSchema = exports.applicationIdParamsSchema = exports.updateApplicationSchema = exports.createApplicationSchema = void 0;
// backend/src/modules/work/applications/application.schemas.ts
const zod_1 = require("zod");
exports.createApplicationSchema = zod_1.z.object({
    proposedRate: zod_1.z.number().nonnegative(),
    message: zod_1.z.string().max(2000).optional(),
});
exports.updateApplicationSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
});
exports.applicationIdParamsSchema = zod_1.z.object({
    applicationId: zod_1.z.string().uuid(),
});
exports.jobIdParamsSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid(),
});
exports.listApplicationsQuerySchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().optional(),
    workerId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
    limit: zod_1.z.string().transform(v => (v ? parseInt(v) : 50)).optional(),
    offset: zod_1.z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});
