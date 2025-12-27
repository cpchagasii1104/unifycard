export type InstantRequestStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type WorkerOnlineStatus = 'online' | 'offline';
/**
 * Status do job instantâneo (fluxo completo da corrida)
 */
export declare enum InstantJobStatus {
    PENDING = "pending",// request criada, aguardando worker
    ACCEPTED = "accepted",// worker aceitou
    EN_ROUTE = "en_route",// worker indo até o cliente
    ARRIVED = "arrived",// worker chegou ao local
    IN_SERVICE = "in_service",// serviço iniciado
    COMPLETED = "completed",// serviço concluído
    CANCELLED = "cancelled",// cancelado pelo cliente
    EXPIRED = "expired"
}
export interface InstantRequest {
    requestId: string;
    tenantId: string;
    customerUserId: string;
    categoryId: string;
    latitude: number;
    longitude: number;
    description?: string;
    status: InstantRequestStatus;
    jobStatus?: InstantJobStatus;
    tempJobId?: string;
    assignmentId?: string;
    acceptedByWorkerId?: string;
    createdAt: Date;
    expiresAt: Date;
    statusHistory?: Array<{
        status: InstantJobStatus;
        timestamp: Date;
        updatedBy: string;
    }>;
    metadata?: Record<string, any>;
}
export interface CreateInstantRequestInput {
    categoryId: string;
    latitude: number;
    longitude: number;
    description?: string;
}
export interface WorkerMatch {
    workerId: string;
    userId: string;
    distance: number;
    rating?: number;
    estimatedTime?: number;
}
//# sourceMappingURL=instant.types.d.ts.map