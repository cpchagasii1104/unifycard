"use strict";
// src/modules/work-instant/worker-status.service.ts
//
// Serviço para gerenciar status online/offline e localização de workers
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerStatusService = void 0;
class WorkerStatusService {
    // Storage temporária em memória
    // Futuramente migrar para Redis para suportar múltiplas instâncias
    presenceStore = new Map();
    pruneInterval = null;
    DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
    constructor() {
        // Iniciar cron job interno para limpeza automática
        // Futuramente substituir por bullmq ou cron real
        this.startPruneInterval();
    }
    /**
     * Inicia o intervalo de limpeza automática
     */
    startPruneInterval() {
        this.pruneInterval = setInterval(() => {
            this.pruneInactiveWorkers().catch((error) => {
                console.error('Error pruning inactive workers:', error);
            });
        }, 30 * 1000); // A cada 30 segundos
    }
    /**
     * Para o intervalo de limpeza (útil para testes ou shutdown)
     */
    stopPruneInterval() {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
            this.pruneInterval = null;
        }
    }
    /**
     * Marca worker como online
     */
    async goOnline(tenantId, userId, latitude, longitude) {
        const key = `${tenantId}:${userId}`;
        const now = Date.now();
        const presence = {
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
    async goOffline(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        const now = Date.now();
        const existing = this.presenceStore.get(key);
        const presence = {
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
    async updateLocation(tenantId, userId, input) {
        const key = `${tenantId}:${userId}`;
        const now = Date.now();
        const existing = this.presenceStore.get(key);
        // Se não existe presença, criar como online
        const presence = existing || {
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
    async getPresence(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        return this.presenceStore.get(key) || null;
    }
    /**
     * Busca workers online de uma categoria próxima a uma localização
     */
    async getOnlineWorkersByCategory(tenantId, categoryId, latitude, longitude, radiusKm = 10) {
        // 1. Buscar workers online com lastSeen recente
        const onlinePresences = await this.getOnlineWorkers(tenantId);
        if (onlinePresences.length === 0) {
            return [];
        }
        // 2. Buscar workers da categoria (via skills ou category)
        // Por enquanto, vamos buscar todos os workers ativos
        const { runQueriesWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const workers = await runQueriesWithTenant(tenantId, `
      SELECT 
        w.worker_id,
        w.user_id
      FROM workers w
      WHERE w.tenant_id = $1 
        AND w.is_active = true
      LIMIT 100
      `, [tenantId]);
        if (!workers) {
            return [];
        }
        // 3. Criar mapa de presenças para lookup rápido
        const presenceMap = new Map();
        for (const presence of onlinePresences) {
            presenceMap.set(presence.userId, presence);
        }
        // 4. Filtrar workers online e calcular distâncias
        const onlineWorkers = [];
        for (const worker of workers) {
            const presence = presenceMap.get(worker.user_id);
            // Apenas workers online com presença ativa
            if (!presence) {
                continue;
            }
            // Se tem localização, calcular distância
            if (presence.location) {
                const distance = this.calculateDistance(latitude, longitude, presence.location.latitude, presence.location.longitude);
                // Filtrar por raio
                if (distance <= radiusKm) {
                    onlineWorkers.push({
                        userId: worker.user_id,
                        workerId: worker.worker_id,
                        distance,
                        location: presence.location,
                    });
                }
            }
            else {
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
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    /**
     * Lista todos os workers online (para debug/admin)
     */
    async listOnlineWorkers(tenantId) {
        const online = [];
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
    async getOnlineWorkers(tenantId, timeoutMs = this.DEFAULT_TIMEOUT_MS) {
        const now = Date.now();
        const online = [];
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
    async pruneInactiveWorkers(timeoutMs = this.DEFAULT_TIMEOUT_MS) {
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
exports.workerStatusService = new WorkerStatusService();
//# sourceMappingURL=worker-status.service.js.map