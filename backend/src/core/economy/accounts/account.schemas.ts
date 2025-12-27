// backend/src/core/economy/accounts/account.schemas.ts

import { z } from 'zod';

/**
 * Schema para criar conta
 */
export const createAccountSchema = z.object({
  ownerId: z.string().uuid('Invalid owner ID format'),
  ownerType: z.enum(['user', 'merchant', 'community_fund', 'platform_ops', 'group'], {
    errorMap: () => ({
      message:
        'Invalid owner type. Must be one of: user, merchant, community_fund, platform_ops, group',
    }),
  }),
  currency: z.enum(['BRL', 'USD', 'EUR', 'TEST']).optional(),
});

/**
 * Schema para validar UUID nos params
 */
export const accountIdSchema = z.object({
  accountId: z.string().uuid('Invalid account ID format'),
});

/**
 * Schema para validar owner ID nos params
 */
export const ownerIdSchema = z.object({
  ownerId: z.string().uuid('Invalid owner ID format'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;