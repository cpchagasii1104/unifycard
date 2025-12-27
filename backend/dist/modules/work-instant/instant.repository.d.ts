import type { InstantRequest } from './instant.types';
declare class InstantRepository {
    private requests;
    /**
     * Salva uma request
     */
    save(request: InstantRequest): void;
    /**
     * Busca request por ID
     */
    findById(requestId: string): InstantRequest | null;
    /**
     * Atualiza status de uma request
     */
    updateStatus(requestId: string, status: InstantRequest['status']): boolean;
    /**
     * Atualiza jobStatus de uma request
     */
    updateJobStatus(requestId: string, jobStatus: import('./instant.types').InstantJobStatus, updatedBy: string): boolean;
    /**
     * Busca status atual de uma request
     */
    getStatus(requestId: string): {
        status: InstantRequest['status'];
        jobStatus?: import('./instant.types').InstantJobStatus;
    } | null;
    /**
     * Atualiza request completa
     */
    update(request: InstantRequest): boolean;
    /**
     * Remove request
     */
    delete(requestId: string): boolean;
    /**
     * Lista todas as requests (para debug/admin)
     */
    findAll(): InstantRequest[];
    /**
     * Limpa requests expiradas
     */
    cleanupExpired(): number;
}
export declare const instantRepository: InstantRepository;
export {};
//# sourceMappingURL=instant.repository.d.ts.map