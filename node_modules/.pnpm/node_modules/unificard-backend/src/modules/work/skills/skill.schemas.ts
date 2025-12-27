// backend/src/modules/work/skills/skill.schemas.ts
import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(2000).optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
});

export const skillIdParamsSchema = z.object({
  skillId: z.string().uuid(),
});

export const listSkillsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v) : undefined)),
  offset: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v) : undefined)),
});
