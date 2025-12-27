import type { FastifyRequest } from 'fastify';
/**
 * Emite evento quando um job é criado
 */
export declare function emitJobCreated(tenantId: string, userId: string, jobId: string, requestId?: string): Promise<void>;
/**
 * Emite evento quando uma aplicação é criada
 */
export declare function emitApplicationCreated(tenantId: string, userId: string, applicationId: string, jobId: string, workerId: string, requestId?: string): Promise<void>;
/**
 * Emite evento quando um assignment é criado
 */
export declare function emitAssignmentCreated(tenantId: string, userId: string, assignmentId: string, jobId: string, workerId: string, requestId?: string): Promise<void>;
/**
 * Emite evento quando um assignment é completado
 */
export declare function emitAssignmentCompleted(tenantId: string, userId: string, assignmentId: string, jobId: string, workerId: string, paymentTransactionId?: string, requestId?: string): Promise<void>;
/**
 * Helper para extrair requestId de um FastifyRequest
 */
export declare function getRequestId(req: FastifyRequest): string | undefined;
//# sourceMappingURL=work.events.d.ts.map