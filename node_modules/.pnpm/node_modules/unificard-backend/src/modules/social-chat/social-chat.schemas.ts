// src/modules/social-chat/social-chat.schemas.ts
import { z } from 'zod';

export const mediaItemSchema = z.object({
  type: z.enum(['image', 'video', 'audio']),
  url: z.string().url('URL inválida'),
  thumbnailUrl: z.string().url('URL de thumbnail inválida').optional(),
  duration: z.number().int().min(0, 'Duração deve ser positiva').optional(),
  metadata: z.record(z.any()).optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('ID da conversa inválido').optional(),
  text: z.string().min(1, 'Texto ou áudio é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres').optional(),
  audioUrl: z.string().url('URL de áudio inválida').optional(),
  media: z.array(mediaItemSchema).max(10, 'Máximo 10 itens de mídia').optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => data.text || data.audioUrl, {
  message: 'Texto ou audioUrl é obrigatório',
  path: ['text'],
});








