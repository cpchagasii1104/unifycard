// backend/src/modules/work/jobs/job.schemas.ts
import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  requiredSkills: z.array(z.string().uuid()).min(1),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  scheduledAt: z.string().datetime().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

export const updateJobSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const listJobsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']).optional(),
  requiredSkill: z.string().uuid().optional(),
  minBudget: z.string().transform(v => (v ? Number(v) : undefined)).optional(),
  maxBudget: z.string().transform(v => (v ? Number(v) : undefined)).optional(),
  lat: z.string().transform(v => (v ? Number(v) : undefined)).optional(),
  lng: z.string().transform(v => (v ? Number(v) : undefined)).optional(),
  radiusKm: z.string().transform(v => (v ? Number(v) : undefined)).optional(),
  limit: z.string().transform(v => (v ? parseInt(v) : 20)).optional(),
  offset: z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});
