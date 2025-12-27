// backend/src/modules/work/assignments/assignment.schemas.ts

import { z } from 'zod';

//
// ============================================================
// CREATE ASSIGNMENT
// ============================================================
//
export const createAssignmentSchema = z.object({
  workerId: z.string().uuid(),
  agreedRate: z.number().nonnegative(),
  paymentType: z.enum(['fixed', 'hourly']),
});

//
// ============================================================
// UPDATE ASSIGNMENT
// ============================================================
//
export const updateAssignmentSchema = z.object({
  status: z.enum(['assigned', 'in_progress', 'completed', 'cancelled']).optional(),
});

//
// ============================================================
// PARAMS SCHEMAS
// ============================================================
//
export const assignmentIdParamsSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

//
// ============================================================
// LIST ASSIGNMENTS FILTERS
// ============================================================
//
export const listAssignmentsQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  status: z
    .enum(['assigned', 'in_progress', 'completed', 'cancelled'])
    .optional(),
  limit: z.string().transform(v => (v ? parseInt(v) : 50)).optional(),
  offset: z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});

//
// ============================================================
// ⭐ COMPLETE ASSIGNMENT — REVIEW UNIVERSAL
// ============================================================
//
export const completeAssignmentBodySchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional(),

  qualityRating: z.number().min(1).max(5).optional(),
  punctualityRating: z.number().min(1).max(5).optional(),
  professionalismRating: z.number().min(1).max(5).optional(),
});
