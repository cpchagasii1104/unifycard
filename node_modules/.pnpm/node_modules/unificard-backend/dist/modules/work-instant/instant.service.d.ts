import type { InstantRequest, CreateInstantRequestInput, WorkerMatch } from './instant.types';
declare class InstantService {
    /**
     * Busca workers online de uma categoria
     * Usa workerStatusService para buscar workers online com localização
     */
    private findOnlineWorkersByCategory;
    /**
     * Cria uma request de serviço instantâneo
     */
    requestService(tenantId: string, customerUserId: string, input: CreateInstantRequestInput): Promise<{
        requestId: string;
        workersMatched: WorkerMatch[];
    }>;
    /**
     * Worker aceita uma request
     */
    acceptRequest(tenantId: string, requestId: string, workerUserId: string): Promise<{
        assignment: any;
        request: InstantRequest;
    }>;
    /**
     * Customer cancela uma request
     */
    cancelRequest(tenantId: string, requestId: string, customerUserId: string): Promise<InstantRequest>;
    /**
     * Expira uma request (chamado por cron job ou timeout)
     */
    expireRequest(requestId: string): Promise<boolean>;
    /**
     * Busca request por ID
     */
    getRequest(requestId: string): Promise<InstantRequest | null>;
}
export declare const instantService: InstantService;
export {};
//# sourceMappingURL=instant.service.d.ts.map