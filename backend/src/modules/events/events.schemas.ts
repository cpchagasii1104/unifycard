// src/modules/events/events.schemas.ts
import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
  startTime: z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
  endTime: z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
  cityId: z.string().uuid('ID da cidade inválido').nullable().optional(),
  stateId: z.string().uuid('ID do estado inválido').nullable().optional(),
  countryId: z.string().uuid('ID do país inválido').nullable().optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'Data/hora de fim deve ser posterior à data/hora de início',
  path: ['endTime'],
});

export const addSessionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  startTime: z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
  endTime: z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
}).refine((data) => data.endTime > data.startTime, {
  message: 'Data/hora de fim deve ser posterior à data/hora de início',
  path: ['endTime'],
});

export const assignStaffSchema = z.object({
  globalUserId: z.string().uuid('ID do usuário global inválido'),
  role: z.string().min(1, 'Função é obrigatória').max(100, 'Função deve ter no máximo 100 caracteres'),
});

export const checkInSchema = z.object({
  // Não precisa de body, apenas do eventId na URL
}).optional();








