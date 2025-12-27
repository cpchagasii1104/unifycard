// src/modules/schedule/schedule.schemas.ts
import { z } from 'zod';

export const createScheduleSchema = z.object({
  globalUserId: z.string().uuid('ID do usuário global inválido').nullable().optional(),
  companyId: z.string().uuid('ID da empresa inválido').nullable().optional(),
  serviceId: z.string().uuid('ID do serviço inválido').nullable().optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => {
  const hasOwner = data.globalUserId || data.companyId || data.serviceId;
  return !!hasOwner;
}, {
  message: 'Deve fornecer globalUserId, companyId ou serviceId',
  path: ['globalUserId'],
});

export const addSlotSchema = z.object({
  startTime: z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
  endTime: z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
  status: z.enum(['available', 'reserved', 'blocked']).optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'Data/hora de fim deve ser posterior à data/hora de início',
  path: ['endTime'],
});

export const reserveSlotSchema = z.object({
  slotId: z.string().uuid('ID do slot inválido'),
  actionId: z.string().uuid('ID da ação inválido').optional(),
  metadata: z.record(z.any()).optional(),
});

export const slotStatusSchema = z.enum(['available', 'reserved', 'blocked']);








