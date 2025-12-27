// src/modules/events/organizers/organizers.schemas.ts
import { z } from 'zod';

export const createOrganizerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  description: z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
  logoUrl: z.string().url('URL do logo inválida').nullable().optional(),
});

export const addMemberSchema = z.object({
  globalUserId: z.string().uuid('ID do usuário global inválido'),
  role: z.enum(['owner', 'admin', 'editor', 'viewer'], {
    errorMap: () => ({ message: 'Role deve ser: owner, admin, editor ou viewer' }),
  }),
});

export const linkEventSchema = z.object({
  organizerId: z.string().uuid('ID do organizador inválido'),
});








