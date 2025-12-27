"use strict";
// src/core/config/observation-mode.service.ts
// Serviço para verificar e gerenciar modo observação (freeze mode)
Object.defineProperty(exports, "__esModule", { value: true });
exports.observationModeService = void 0;
class ObservationModeService {
    /**
     * Verifica se o modo observação está ativo
     */
    isEnabled() {
        return process.env.OBSERVATION_MODE === 'true';
    }
    /**
     * Lança erro se modo observação estiver ativo
     */
    throwIfEnabled(operation) {
        if (this.isEnabled()) {
            const error = new Error(`OBSERVATION MODE ATIVO: Operação "${operation}" bloqueada. Nenhuma feature estrutural deve ser adicionada.`);
            error.name = 'ObservationModeError';
            throw error;
        }
    }
    /**
     * Loga warning se modo observação estiver ativo
     */
    logWarning(operation) {
        if (this.isEnabled()) {
            console.warn(JSON.stringify({
                timestamp: new Date().toISOString(),
                module: 'system',
                eventType: 'observation_mode_warning',
                operation,
                message: `OBSERVATION MODE ATIVO: Tentativa de ${operation} bloqueada`,
            }));
        }
    }
}
exports.observationModeService = new ObservationModeService();
//# sourceMappingURL=observation-mode.service.js.map