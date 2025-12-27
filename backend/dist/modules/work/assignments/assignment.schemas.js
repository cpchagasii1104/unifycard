"use strict";
// backend/src/modules/work/assignments/assignment.schemas.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeAssignmentBodySchema = exports.listAssignmentsQuerySchema = exports.jobIdParamsSchema = exports.assignmentIdParamsSchema = exports.updateAssignmentSchema = exports.createAssignmentSchema = void 0;
const zod_1 = require("zod");
//
// ============================================================
// CREATE ASSIGNMENT
// ============================================================
//
exports.createAssignmentSchema = zod_1.z.object({
    workerId: zod_1.z.string().uuid(),
    agreedRate: zod_1.z.number().nonnegative(),
    paymentType: zod_1.z.enum(['fixed', 'hourly']),
});
//
// ============================================================
// UPDATE ASSIGNMENT
// ============================================================
//
exports.updateAssignmentSchema = zod_1.z.object({
    status: zod_1.z.enum(['assigned', 'in_progress', 'completed', 'cancelled']).optional(),
});
//
// ============================================================
// PARAMS SCHEMAS
// ============================================================
//
exports.assignmentIdParamsSchema = zod_1.z.object({
    assignmentId: zod_1.z.string().uuid(),
});
exports.jobIdParamsSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid(),
});
//
// ============================================================
// LIST ASSIGNMENTS FILTERS
// ============================================================
//
exports.listAssignmentsQuerySchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().optional(),
    workerId: zod_1.z.string().uuid().optional(),
    status: zod_1.z
        .enum(['assigned', 'in_progress', 'completed', 'cancelled'])
        .optional(),
    limit: zod_1.z.string().transform(v => (v ? parseInt(v) : 50)).optional(),
    offset: zod_1.z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});
//
// ============================================================
// ⭐ COMPLETE ASSIGNMENT — REVIEW UNIVERSAL
// ============================================================
//
exports.completeAssignmentBodySchema = zod_1.z.object({
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional(),
    qualityRating: zod_1.z.number().min(1).max(5).optional(),
    punctualityRating: zod_1.z.number().min(1).max(5).optional(),
    professionalismRating: zod_1.z.number().min(1).max(5).optional(),
});
//# sourceMappingURL=assignment.schemas.js.map