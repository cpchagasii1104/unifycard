import type { WorkerMatch } from './instant.types';
interface RequestPayload {
    categoryId: string;
    latitude: number;
    longitude: number;
    description?: string;
}
declare class SmartMatchingService {
    /**
     * Normaliza um valor para escala 0-1
     */
    private normalize;
    /**
     * Calcula score de distância (quanto mais perto, maior o score)
     */
    private calculateDistanceScore;
    /**
     * Busca e calcula reputationScore
     */
    private getReputationScore;
    /**
     * Busca e calcula performanceScore
     */
    private getPerformanceScore;
    /**
     * Calcula responseScore baseado no Memory Engine
     * Tempo médio para aceitar requests (quanto menor, maior o score)
     */
    private getResponseScore;
    /**
     * Calcula specializationScore baseado em skills/categoria
     */
    private getSpecializationScore;
    /**
     * Calcula experienceScore baseado em assignments concluídos na categoria
     */
    private getExperienceScore;
    /**
     * Calcula availabilityScore baseado em lastSeen
     */
    private calculateAvailabilityScore;
    /**
     * Ordena workers usando matching inteligente
     * Calcula múltiplos scores e faz média ponderada
     */
    smartSortWorkers(workers: WorkerMatch[], requestPayload: RequestPayload, tenantId: string): Promise<WorkerMatch[]>;
}
export declare const smartMatchingService: SmartMatchingService;
export {};
//# sourceMappingURL=smart-matching.service.d.ts.map