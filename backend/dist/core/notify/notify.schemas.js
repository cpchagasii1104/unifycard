"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailToTargetSchema = exports.pushToUserSchema = exports.listNotificationsQuerySchema = exports.enqueueNotificationSchema = exports.notificationIdSchema = void 0;
// src/core/notify/notify.schemas.ts
const zod_1 = require("zod");
exports.notificationIdSchema = zod_1.z.object({
    notificationId: zod_1.z.string().uuid('Invalid notification ID'),
});
exports.enqueueNotificationSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid().optional(),
    channel: zod_1.z.enum(['email', 'sms', 'push', 'webhook', 'in_app']),
    templateName: zod_1.z.string().max(100).optional(),
    target: zod_1.z.string().min(1).max(500),
    payload: zod_1.z.record(zod_1.z.any()).optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
    maxRetries: zod_1.z.number().min(0).max(10).optional(),
});
exports.listNotificationsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'processing', 'sent', 'failed']).optional(),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
});
exports.pushToUserSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1).max(100),
    body: zod_1.z.string().min(1).max(1000),
    data: zod_1.z.record(zod_1.z.any()).optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
    maxRetries: zod_1.z.number().min(0).max(10).optional(),
});
exports.emailToTargetSchema = zod_1.z.object({
    targetEmail: zod_1.z.string().email(),
    subject: zod_1.z.string().min(1).max(200),
    body: zod_1.z.string().min(1).max(10000),
    scheduledAt: zod_1.z.string().datetime().optional(),
    maxRetries: zod_1.z.number().min(0).max(10).optional(),
});
//# sourceMappingURL=notify.schemas.js.map