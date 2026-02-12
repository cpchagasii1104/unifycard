// src/core/rbac/role.schemas.ts
import { z } from 'zod';

export const roleIdSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
});

export const userIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const roleUserParamsSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  userId: z.string().uuid('Invalid user ID'),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
});

export const assignRoleByNameSchema = z.object({
  roleName: z.string().min(2).max(50),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
