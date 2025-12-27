// src/modules/social/social.schemas.ts
import { z } from 'zod';

export const mediaItemSchema = z.object({
  type: z.enum(['image', 'video', 'audio']),
  url: z.string().url('URL inválida'),
  thumbnailUrl: z.string().url('URL de thumbnail inválida').optional(),
  duration: z.number().int().min(0, 'Duração deve ser positiva').optional(),
  metadata: z.record(z.any()).optional(),
});

export const suggestedActionSchema = z.object({
  action: z.string(),
  module: z.string(),
  endpoint: z.string().optional(),
  payload: z.record(z.any()).optional(),
  description: z.string(),
});

export const createPostSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório').max(10000, 'Conteúdo deve ter no máximo 10000 caracteres'),
  media: z.array(mediaItemSchema).max(10, 'Máximo 10 itens de mídia').optional(),
  metadata: z.record(z.any()).optional(),
  categories: z.array(z.string().uuid('ID de categoria inválido')).optional(),
  intent: z.string().optional(),
});

export const feedOptionsSchema = z.object({
  limit: z.number().int().min(1, 'Limit mínimo é 1').max(100, 'Limit máximo é 100').optional(),
  offset: z.number().int().min(0, 'Offset mínimo é 0').optional(),
  categoryId: z.string().uuid('ID de categoria inválido').optional(),
  intent: z.string().optional(),
  userId: z.string().uuid('ID do usuário inválido').optional(),
  startDate: z.string().datetime('Data de início inválida').optional(),
  endDate: z.string().datetime('Data de fim inválida').optional(),
});








