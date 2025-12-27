// src/modules/work-instant/instant.repository.ts
//
// Repositório temporário usando Map (futuramente migrar para Redis)

import type { InstantRequest } from './instant.types';

class InstantRepository {
  // Store temporário em memória
  // Futuramente migrar para Redis para suportar múltiplas instâncias
  private requests = new Map<string, InstantRequest>();

  /**
   * Salva uma request
   */
  save(request: InstantRequest): void {
    this.requests.set(request.requestId, request);
  }

  /**
   * Busca request por ID
   */
  findById(requestId: string): InstantRequest | null {
    return this.requests.get(requestId) || null;
  }

  /**
   * Atualiza status de uma request
   */
  updateStatus(requestId: string, status: InstantRequest['status']): boolean {
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
  updateJobStatus(
    requestId: string,
    jobStatus: import('./instant.types').InstantJobStatus,
    updatedBy: string
  ): boolean {
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
  getStatus(requestId: string): {
    status: InstantRequest['status'];
    jobStatus?: import('./instant.types').InstantJobStatus;
  } | null {
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
  update(request: InstantRequest): boolean {
    if (!this.requests.has(request.requestId)) {
      return false;
    }
    this.requests.set(request.requestId, request);
    return true;
  }

  /**
   * Remove request
   */
  delete(requestId: string): boolean {
    return this.requests.delete(requestId);
  }

  /**
   * Lista todas as requests (para debug/admin)
   */
  findAll(): InstantRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Limpa requests expiradas
   */
  cleanupExpired(): number {
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

export const instantRepository = new InstantRepository();

