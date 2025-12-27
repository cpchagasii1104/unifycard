import { z } from 'zod';
export declare const notificationIdSchema: z.ZodObject<{
    notificationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    notificationId: string;
}, {
    notificationId: string;
}>;
export declare const enqueueNotificationSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    channel: z.ZodEnum<["email", "sms", "push", "webhook", "in_app"]>;
    templateName: z.ZodOptional<z.ZodString>;
    target: z.ZodString;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    channel: "push" | "email" | "sms" | "webhook" | "in_app";
    target: string;
    userId?: string | undefined;
    templateName?: string | undefined;
    payload?: Record<string, any> | undefined;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}, {
    channel: "push" | "email" | "sms" | "webhook" | "in_app";
    target: string;
    userId?: string | undefined;
    templateName?: string | undefined;
    payload?: Record<string, any> | undefined;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}>;
export declare const listNotificationsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "processing", "sent", "failed"]>>;
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
    status?: "pending" | "processing" | "sent" | "failed" | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    status?: "pending" | "processing" | "sent" | "failed" | undefined;
}>;
export declare const pushToUserSchema: z.ZodObject<{
    userId: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    body: string;
    userId: string;
    title: string;
    data?: Record<string, any> | undefined;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}, {
    body: string;
    userId: string;
    title: string;
    data?: Record<string, any> | undefined;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}>;
export declare const emailToTargetSchema: z.ZodObject<{
    targetEmail: z.ZodString;
    subject: z.ZodString;
    body: z.ZodString;
    scheduledAt: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    body: string;
    subject: string;
    targetEmail: string;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}, {
    body: string;
    subject: string;
    targetEmail: string;
    scheduledAt?: string | undefined;
    maxRetries?: number | undefined;
}>;
export type EnqueueNotificationInput = z.infer<typeof enqueueNotificationSchema>;
export type PushToUserInput = z.infer<typeof pushToUserSchema>;
export type EmailToTargetInput = z.infer<typeof emailToTargetSchema>;
//# sourceMappingURL=notify.schemas.d.ts.map