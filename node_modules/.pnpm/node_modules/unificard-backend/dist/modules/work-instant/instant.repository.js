"use strict";
// src/modules/work-instant/instant.repository.ts
//
// Repositório temporário usando Map (futuramente migrar para Redis)
Object.defineProperty(exports, "__esModule", { value: true });
exports.instantRepository = void 0;
class InstantRepository {
    // Store temporário em memória
    // Futuramente migrar para Redis para suportar múltiplas instâncias
    requests = new Map();
    /**
     * Salva uma request
     */
    save(request) {
        this.requests.set(request.requestId, request);
    }
    /**
     * Busca request por ID
     */
    findById(requestId) {
        return this.requests.get(requestId) || null;
    }
    /**
     * Atualiza status de uma request
     */
    updateStatus(requestId, status) {
        const request = this.requests.get(requestId);
        if (!request) {
            return false;
        }
        request.status = status;
        this.requests.set(requestId, request);
        return true;
    }
    /**
     * Atualiza jobStatus de uma request
     */
    updateJobStatus(requestId, jobStatus, updatedBy) {
        const request = this.requests.get(requestId);
        if (!request) {
            return false;
        }
        request.jobStatus = jobStatus;
        // Registrar no histórico
        if (!request.statusHistory) {
            request.statusHistory = [];
        }
        request.statusHistory.push({
            status: jobStatus,
            timestamp: new Date(),
            updatedBy,
        });
        this.requests.set(requestId, request);
        return true;
    }
    /**
     * Busca status atual de uma request
     */
    getStatus(requestId) {
        const request = this.requests.get(requestId);
        if (!request) {
            return null;
        }
        return {
            status: request.status,
            jobStatus: request.jobStatus,
        };
    }
    /**
     * Atualiza request completa
     */
    update(request) {
        if (!this.requests.has(request.requestId)) {
            return false;
        }
        this.requests.set(request.requestId, request);
        return true;
    }
    /**
     * Remove request
     */
    delete(requestId) {
        return this.requests.delete(requestId);
    }
    /**
     * Lista todas as requests (para debug/admin)
     */
    findAll() {
        return Array.from(this.requests.values());
    }
    /**
     * Limpa requests expiradas
     */
    cleanupExpired() {
        const now = new Date();
        let cleaned = 0;
        for (const [requestId, request] of this.requests.entries()) {
            if (request.expiresAt < now && request.status === 'pending') {
                request.status = 'expired';
                this.requests.set(requestId, request);
                cleaned++;
            }
        }
        return cleaned;
    }
}
exports.instantRepository = new InstantRepository();
//# sourceMappingURL=instant.repository.js.map