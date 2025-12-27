"use strict";
// src/modules/work-instant/tracking.service.ts
//
// Serviço de rastreamento GPS em tempo real para jobs instantâneos
// Gerencia jobs ativos e vincula workers a customers
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingService = void 0;
class TrackingService {
    // Mapa de rastreamentos ativos: requestId -> ActiveTracking
    activeTrackings = new Map();
    /**
     * Define um rastreamento ativo
     */
    setActiveTracking(tenantId, requestId, workerUserId, customerUserId, jobId) {
        this.activeTrackings.set(requestId, {
            requestId,
            workerUserId,
            customerUserId,
            jobId,
            tenantId,
            startedAt: Date.now(),
        });
    }
    /**
     * Remove um rastreamento ativo
     */
    clearTracking(requestId) {
        this.activeTrackings.delete(requestId);
    }
    /**
     * Busca job instantâneo ativo para um worker
     */
    getActiveInstantJobForWorker(tenantId, workerUserId) {
        for (const tracking of this.activeTrackings.values()) {
            if (tracking.tenantId === tenantId &&
                tracking.workerUserId === workerUserId) {
                return tracking;
            }
        }
        return null;
    }
    /**
     * Busca rastreamento ativo por requestId
     */
    getActiveTracking(requestId) {
        return this.activeTrackings.get(requestId) || null;
    }
    /**
     * Busca rastreamento ativo por customerUserId
     */
    getActiveTrackingForCustomer(tenantId, customerUserId) {
        for (const tracking of this.activeTrackings.values()) {
            if (tracking.tenantId === tenantId &&
                tracking.customerUserId === customerUserId) {
                return tracking;
            }
        }
        return null;
    }
    /**
     * Lista todos os rastreamentos ativos (para debug/admin)
     */
    getAllActiveTrackings(tenantId) {
        const trackings = [];
        for (const tracking of this.activeTrackings.values()) {
            if (!tenantId || tracking.tenantId === tenantId) {
                trackings.push(tracking);
            }
        }
        return trackings;
    }
}
exports.trackingService = new TrackingService();
//# sourceMappingURL=tracking.service.js.map