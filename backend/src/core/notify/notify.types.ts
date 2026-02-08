// backend/src/core/notify/notify.types.ts

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in_app';

export type NotificationStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'canceled';

export interface NotificationPayload {
  [key: string]: unknown;
}

export interface NotifyTemplateRow {
  template_id: string;
  tenant_id: string;
  channel: string;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  metadata: unknown;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotifyTemplate {
  templateId: string;
  tenantId: string;
  channel: NotificationChannel;
  name: string;
  description?: string | null;
  subject?: string | null;
  body: string;
  metadata: NotificationPayload;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationQueueRow {
  notification_id: string;
  tenant_id: string;
  user_id: string | null;
  channel: string;
  template_name: string | null;
  target: string;
  payload: unknown;
  status: string;
  retry_count: number;
  max_retries: number;
  scheduledAt: Date;
  sentAt: Date | null;
  last_error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  notificationId: string;
  tenantId: string;
  userId?: string | null;
  channel: NotificationChannel;
  templateName?: string | null;
  target: string;
  payload: NotificationPayload;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date;
  sentAt?: Date | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueNotificationInput {
  tenantId: string;
  userId?: string | null;
  channel: NotificationChannel;
  templateName?: string | null;
  target: string;
  payload: NotificationPayload;
  scheduledAt?: Date;
  maxRetries?: number;
}

export interface ProviderResult {
  success: boolean;
  error?: string;
  providerId?: string;
}

export interface EmailDetails {
  to: string;
  subject: string;
  body: string;
}

export interface SmsDetails {
  to: string;
  body: string;
}

export interface PushDetails {
  to: string; // device token
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface WebhookDetails {
  url: string;
  payload: NotificationPayload;
  headers?: Record<string, string>;
}

export interface TemplateRenderContext {
  tenantId: string;
  channel: NotificationChannel;
  templateName: string;
  payload: NotificationPayload;
}


