// src/modules/work-instant/worker-status.service.ts
//
// Serviço para gerenciar status online/offline e localização de workers

import { runQueryWithTenant } from '@core/database/pool';
import type { WorkerPresence, WorkerStatus, WorkerLocation, UpdateLocationInput } from './worker-status.types';

class WorkerStatusService {
  // Storage temporária em memória
  // Futuramente migrar para Redis para suportar múltiplas instâncias
  private presenceStore = new Map<string, WorkerPresence>();
  private pruneInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos

  constructor() {
    // Iniciar cron job interno para limpeza automática
    // Futuramente substituir por bullmq ou cron real
    this.startPruneInterval();
  }

  /**
   * Inicia o intervalo de limpeza automática
   */
  private startPruneInterval(): void {
    this.pruneInterval = setInterval(() => {
      this.pruneInactiveWorkers().catch((error) => {
        console.error('Error pruning inactive workers:', error);
      });
    }, 30 * 1000); // A cada 30 segundos
  }

  /**
   * Para o intervalo de limpeza (útil para testes ou shutdown)
   */
  stopPruneInterval(): void {
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
  }

  /**
   * Marca worker como online
   */
  async goOnline(
    tenantId: string,
    userId: string,
    latitude?: number,
    longitude?: number
  ): Promise<WorkerPresence> {
    const key = `${tenantId}:${userId}`;
    const now = Date.now();

    const presence: WorkerPresence = {
      userId,
      tenantId,
      status: 'online',
      lastSeen: now,
    };

    // Se latitude e longitude foram fornecidos, adicionar localização
    if (latitude !== undefined && longitude !== undefined) {
      presence.location = {
        latitude,
        longitude,
        updatedAt: now,
      };
    }

    this.presenceStore.set(key, presence);

    return presence;
  }

  /**
   * Marca worker como offline
   */
  async goOffline(tenantId: string, userId: string): Promise<WorkerPresence> {
    const key = `${tenantId}:${userId}`;
    const now = Date.now();

    const existing = this.presenceStore.get(key);
    const presence: WorkerPresence = {
      userId,
      tenantId,
      status: 'offline',
      lastSeen: now,
      // Manter localização anterior se existir
      location: existing?.location,
    };

    this.presenceStore.set(key, presence);

    return presence;
  }

  /**
   * Atualiza localização do worker
   */
  async updateLocation(
    tenantId: string,
    userId: string,
    input: UpdateLocationInput
  ): Promise<WorkerPresence> {
    const key = `${tenantId}:${userId}`;
    const now = Date.now();

    const existing = this.presenceStore.get(key);
    
    if (input.latitude == null || input.longitude == null) {
      throw new Error('Latitude e longitude são obrigatórios');
    }

    // Se não existe presença, criar como online
    const presence: WorkerPresence = existing || {
      userId,
      tenantId,
      status: 'online',
      lastSeen: now,
    };

    // Atualizar localização
    presence.location = {
      latitude: input.latitude,
      longitude: input.longitude,
      updatedAt: now,
    };
    presence.lastSeen = now;

    // Se estava offline, marcar como online ao atualizar localização
    if (presence.status === 'offline') {
      presence.status = 'online';
    }

    this.presenceStore.set(key, presence);

    return presence;
  }

  /**
   * Busca presença de um worker
   */
  async getPresence(tenantId: string, userId: string): Promise<WorkerPresence | null> {
    const key = `${tenantId}:${userId}`;
    return this.presenceStore.get(key) || null;
  }

  /**
   * Busca workers online de uma categoria próxima a uma localização
   */
  async getOnlineWorkersByCategory(
    tenantId: string,
    categoryId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<Array<{ userId: string; workerId: string; distance: number; location?: WorkerLocation }>> {
    // 1. Buscar workers online com lastSeen recente
    const onlinePresences = await this.getOnlineWorkers(tenantId);

    if (onlinePresences.length === 0) {
      return [];
    }

    // 2. Buscar workers da categoria (via skills ou category)
    // Por enquanto, vamos buscar todos os workers ativos
    const { runQueriesWithTenant } = await import('@core/database/pool');
    const workers = await runQueriesWithTenant<{
      worker_id: string;
      user_id: string;
    }>(
      tenantId,
      `
      SELECT 
        w.worker_id,
        w.user_id
      FROM workers w
      WHERE w.tenant_id = $1 
        AND w.is_active = true
      LIMIT 100
      `,
      [tenantId]
    );

    if (!workers) {
      return [];
    }

    // 3. Criar mapa de presenças para lookup rápido
    const presenceMap = new Map<string, WorkerPresence>();
    for (const presence of onlinePresences) {
      presenceMap.set(presence.userId, presence);
    }

    // 4. Filtrar workers online e calcular distâncias
    const onlineWorkers: Array<{ userId: string; workerId: string; distance: number; location?: WorkerLocation }> = [];

    for (const worker of workers) {
      const presence = presenceMap.get(worker.user_id);

      // Apenas workers online com presença ativa
      if (!presence) {
        continue;
      }

      // Se tem localização, calcular distância
      if (presence.location) {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          presence.location.latitude,
          presence.location.longitude
        );

        // Filtrar por raio
        if (distance <= radiusKm) {
          onlineWorkers.push({
            userId: worker.user_id,
            workerId: worker.worker_id,
            distance,
            location: presence.location,
          });
        }
      } else {
        // Se não tem localização, incluir mas com distância alta
        onlineWorkers.push({
          userId: worker.user_id,
          workerId: worker.worker_id,
          distance: 999,
        });
      }
    }

    // 3. Ordenar por distância (mais próximo primeiro)
    onlineWorkers.sort((a, b) => a.distance - b.distance);

    return onlineWorkers.slice(0, 20); // Retornar top 20 mais próximos
  }

  /**
   * Calcula distância entre dois pontos (Haversine)
   * Retorna distância em km
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Lista todos os workers online (para debug/admin)
   */
  async listOnlineWorkers(tenantId: string): Promise<WorkerPresence[]> {
    const online: WorkerPresence[] = [];
    
    for (const [key, presence] of this.presenceStore.entries()) {
      if (presence.tenantId === tenantId && presence.status === 'online') {
        online.push(presence);
      }
    }
    
    return online;
  }

  /**
   * Retorna workers online com lastSeen recente
   * Filtra workers que estão online E tiveram atividade recente
   */
  async getOnlineWorkers(
    tenantId?: string,
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS
  ): Promise<WorkerPresence[]> {
    const now = Date.now();
    const online: WorkerPresence[] = [];

    for (const [key, presence] of this.presenceStore.entries()) {
      // Filtrar por tenant se fornecido
      if (tenantId && presence.tenantId !== tenantId) {
        continue;
      }

      // Apenas workers online
      if (presence.status !== 'online') {
        continue;
      }

      // Verificar se lastSeen está dentro do timeout
      const timeSinceLastSeen = now - presence.lastSeen;
      if (timeSinceLastSeen <= timeoutMs) {
        online.push(presence);
      }
    }

    return online;
  }

  /**
   * Remove (ou coloca offline) workers inativos
   * Workers cujo lastSeen está há mais de timeoutMs são considerados inativos
   */
  async pruneInactiveWorkers(timeoutMs: number = this.DEFAULT_TIMEOUT_MS): Promise<number> {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, presence] of this.presenceStore.entries()) {
      // Apenas processar workers online
      if (presence.status !== 'online') {
        continue;
      }

      // Verificar se está inativo
      const timeSinceLastSeen = now - presence.lastSeen;
      if (timeSinceLastSeen > timeoutMs) {
        // Marcar como offline ao invés de remover (mantém histórico)
        presence.status = 'offline';
        this.presenceStore.set(key, presence);
        removedCount++;
      }
    }

    // Log estruturado (sem requestId pois é processo interno)
    if (removedCount > 0) {
      console.log({
        'work-instant.action': 'prune',
        removedCount,
        timeoutMs,
        source: 'instant_mode',
      }, `Pruned ${removedCount} inactive workers`);
    }

    return removedCount;
  }
}

export const workerStatusService = new WorkerStatusService();

