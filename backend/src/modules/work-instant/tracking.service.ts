// src/modules/work-instant/tracking.service.ts
//
// Serviço de rastreamento GPS em tempo real para jobs instantâneos
// Gerencia jobs ativos e vincula workers a customers

interface ActiveTracking {
  requestId: string;
  workerUserId: string;
  customerUserId: string;
  jobId: string;
  tenantId: string;
  startedAt: number;
  completedAt?: number;
}

class TrackingService {
  // Mapa de rastreamentos ativos: requestId -> ActiveTracking
  private activeTrackings = new Map<string, ActiveTracking>();

  /**
   * Define um rastreamento ativo
   */
  setActiveTracking(
    tenantId: string,
    requestId: string,
    workerUserId: string,
    customerUserId: string,
    jobId: string
  ): void {
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
  clearTracking(requestId: string): void {
    this.activeTrackings.delete(requestId);
  }

  /**
   * Busca job instantâneo ativo para um worker
   */
  getActiveInstantJobForWorker(
    tenantId: string,
    workerUserId: string
  ): ActiveTracking | null {
    for (const tracking of this.activeTrackings.values()) {
      if (
        tracking.tenantId === tenantId &&
        tracking.workerUserId === workerUserId
      ) {
        return tracking;
      }
    }
    return null;
  }

  /**
   * Busca rastreamento ativo por requestId
   */
  getActiveTracking(requestId: string): ActiveTracking | null {
    return this.activeTrackings.get(requestId) || null;
  }

  /**
   * Busca rastreamento ativo por customerUserId
   */
  getActiveTrackingForCustomer(
    tenantId: string,
    customerUserId: string
  ): ActiveTracking | null {
    for (const tracking of this.activeTrackings.values()) {
      if (
        tracking.tenantId === tenantId &&
        tracking.customerUserId === customerUserId
      ) {
        return tracking;
      }
    }
    return null;
  }

  /**
   * Lista todos os rastreamentos ativos (para debug/admin)
   */
  getAllActiveTrackings(tenantId?: string): ActiveTracking[] {
    const trackings: ActiveTracking[] = [];
    
    for (const tracking of this.activeTrackings.values()) {
      if (!tenantId || tracking.tenantId === tenantId) {
        trackings.push(tracking);
      }
    }
    
    return trackings;
  }
}

export const trackingService = new TrackingService();

