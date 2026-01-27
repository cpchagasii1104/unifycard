// src/core/economy/distribution/distribution.schemas.ts
import { z } from 'zod';

export const feeConfigSchema = z.object({
  platformFeePercent: z.number().min(0).max(100).optional(),
  communityFeePercent: z.number().min(0).max(100).optional(),
  groupFeePercent: z.number().min(0).max(100).optional(),
});

export const autoDistributeSchema = z.object({
  fromAccount: z.string().uuid('Invalid source account ID'),
  toAccount: z.string().uuid('Invalid destination account ID'),
  amount: z.number().positive('Amount must be greater than zero'),
  groupAccount: z.string().uuid('Invalid group account ID').optional(),
  config: feeConfigSchema.optional(),
});

export const simulateSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  config: feeConfigSchema.optional(),
});

export const batchCalculateSchema = z.object({
  amounts: z.array(z.number().positive()).min(1).max(100),
  config: feeConfigSchema.optional(),
});

export type AutoDistributeInput = z.infer<typeof autoDistributeSchema>;
export type FeeConfigInput = z.infer<typeof feeConfigSchema>;
