declare class ObservationModeService {
    /**
     * Verifica se o modo observação está ativo
     */
    isEnabled(): boolean;
    /**
     * Lança erro se modo observação estiver ativo
     */
    throwIfEnabled(operation: string): void;
    /**
     * Loga warning se modo observação estiver ativo
     */
    logWarning(operation: string): void;
}
export declare const observationModeService: ObservationModeService;
export {};
//# sourceMappingURL=observation-mode.service.d.ts.map