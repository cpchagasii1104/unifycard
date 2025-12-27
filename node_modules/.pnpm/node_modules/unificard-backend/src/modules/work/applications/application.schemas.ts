// backend/src/modules/work/applications/application.schemas.ts
import { z } from 'zod';

export const createApplicationSchema = z.object({
  proposedRate: z.number().nonnegative(),
  message: z.string().max(2000).optional(),
});

export const updateApplicationSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
});

export const applicationIdParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const listApplicationsQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
  limit: z.string().transform(v => (v ? parseInt(v) : 50)).optional(),
  offset: z.string().transform(v => (v ? parseInt(v) : 0)).optional(),
});
