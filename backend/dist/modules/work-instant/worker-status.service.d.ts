import type { WorkerPresence, WorkerLocation, UpdateLocationInput } from './worker-status.types';
declare class WorkerStatusService {
    private presenceStore;
    private pruneInterval;
    private readonly DEFAULT_TIMEOUT_MS;
    constructor();
    /**
     * Inicia o intervalo de limpeza automática
     */
    private startPruneInterval;
    /**
     * Para o intervalo de limpeza (útil para testes ou shutdown)
     */
    stopPruneInterval(): void;
    /**
     * Marca worker como online
     */
    goOnline(tenantId: string, userId: string, latitude?: number, longitude?: number): Promise<WorkerPresence>;
    /**
     * Marca worker como offline
     */
    goOffline(tenantId: string, userId: string): Promise<WorkerPresence>;
    /**
     * Atualiza localização do worker
     */
    updateLocation(tenantId: string, userId: string, input: UpdateLocationInput): Promise<WorkerPresence>;
    /**
     * Busca presença de um worker
     */
    getPresence(tenantId: string, userId: string): Promise<WorkerPresence | null>;
    /**
     * Busca workers online de uma categoria próxima a uma localização
     */
    getOnlineWorkersByCategory(tenantId: string, categoryId: string, latitude: number, longitude: number, radiusKm?: number): Promise<Array<{
        userId: string;
        workerId: string;
        distance: number;
        location?: WorkerLocation;
    }>>;
    /**
     * Calcula distância entre dois pontos (Haversine)
     * Retorna distância em km
     */
    private calculateDistance;
    private toRad;
    /**
     * Lista todos os workers online (para debug/admin)
     */
    listOnlineWorkers(tenantId: string): Promise<WorkerPresence[]>;
    /**
     * Retorna workers online com lastSeen recente
     * Filtra workers que estão online E tiveram atividade recente
     */
    getOnlineWorkers(tenantId?: string, timeoutMs?: number): Promise<WorkerPresence[]>;
    /**
     * Remove (ou coloca offline) workers inativos
     * Workers cujo lastSeen está há mais de timeoutMs são considerados inativos
     */
    pruneInactiveWorkers(timeoutMs?: number): Promise<number>;
}
export declare const workerStatusService: WorkerStatusService;
export {};
//# sourceMappingURL=worker-status.service.d.ts.map