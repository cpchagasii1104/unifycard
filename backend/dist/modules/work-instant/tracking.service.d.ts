interface ActiveTracking {
    requestId: string;
    workerUserId: string;
    customerUserId: string;
    jobId: string;
    tenantId: string;
    startedAt: number;
    completedAt?: number;
}
declare class TrackingService {
    private activeTrackings;
    /**
     * Define um rastreamento ativo
     */
    setActiveTracking(tenantId: string, requestId: string, workerUserId: string, customerUserId: string, jobId: string): void;
    /**
     * Remove um rastreamento ativo
     */
    clearTracking(requestId: string): void;
    /**
     * Busca job instantâneo ativo para um worker
     */
    getActiveInstantJobForWorker(tenantId: string, workerUserId: string): ActiveTracking | null;
    /**
     * Busca rastreamento ativo por requestId
     */
    getActiveTracking(requestId: string): ActiveTracking | null;
    /**
     * Busca rastreamento ativo por customerUserId
     */
    getActiveTrackingForCustomer(tenantId: string, customerUserId: string): ActiveTracking | null;
    /**
     * Lista todos os rastreamentos ativos (para debug/admin)
     */
    getAllActiveTrackings(tenantId?: string): ActiveTracking[];
}
export declare const trackingService: TrackingService;
export {};
//# sourceMappingURL=tracking.service.d.ts.map