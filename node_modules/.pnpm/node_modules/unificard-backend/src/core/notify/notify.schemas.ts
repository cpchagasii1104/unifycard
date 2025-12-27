// src/core/notify/notify.schemas.ts
import { z } from 'zod';

export const notificationIdSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID'),
});

export const enqueueNotificationSchema = z.object({
  userId: z.string().uuid().optional(),
  channel: z.enum(['email', 'sms', 'push', 'webhook', 'in_app']),
  templateName: z.string().max(100).optional(),
  target: z.string().min(1).max(500),
  payload: z.record(z.any()).optional(),
  scheduledAt: z.string().datetime().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

export const listNotificationsQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'sent', 'failed']).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

export const pushToUserSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(1000),
  data: z.record(z.any()).optional(),
  scheduledAt: z.string().datetime().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

export const emailToTargetSchema = z.object({
  targetEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  scheduledAt: z.string().datetime().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

export type EnqueueNotificationInput = z.infer<typeof enqueueNotificationSchema>;
export type PushToUserInput = z.infer<typeof pushToUserSchema>;
export type EmailToTargetInput = z.infer<typeof emailToTargetSchema>;
