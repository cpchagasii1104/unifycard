// src/core/config/config.schemas.ts
import { z } from 'zod';

export const configKeySchema = z.object({
  module: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
});

export const setConfigSchema = z.object({
  module: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
  valueCents: z.union([z.string(), z.number(), z.boolean(), z.record(z.any()), z.array(z.any())]),
  isSystem: z.boolean().optional(),
});

export const listConfigsQuerySchema = z.object({
  module: z.string().min(1).max(50).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

export const flagNameSchema = z.object({
  flagName: z.string().min(1).max(100),
});

export const upsertFlagSchema = z.object({
  description: z.string().max(255).optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  userWhitelist: z.array(z.string().uuid()).optional(),
});

export const checkFlagQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export const listFlagsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

export type SetConfigInput = z.infer<typeof setConfigSchema>;
export type UpsertFlagInput = z.infer<typeof upsertFlagSchema>;

