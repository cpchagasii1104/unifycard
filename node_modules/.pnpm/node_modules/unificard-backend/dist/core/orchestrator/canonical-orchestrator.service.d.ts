import type { CanonicalEvent } from './contracts/canonical-event';
declare class CanonicalOrchestratorService {
    /**
     * Recebe um evento canônico e processa (apenas logging por enquanto)
     */
    receiveEvent(event: CanonicalEvent): Promise<void>;
}
export declare const canonicalOrchestrator: CanonicalOrchestratorService;
export {};
//# sourceMappingURL=canonical-orchestrator.service.d.ts.map