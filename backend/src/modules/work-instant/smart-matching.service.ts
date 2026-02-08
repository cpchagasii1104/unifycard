// src/modules/work-instant/smart-matching.service.ts
//
// Motor de matching inteligente para Work Instant
// Usa IA + histórico + reputação + sinais comportamentais
//
// 🔴 BLINDAGEM: Educação NÃO participa de matching de workers
// - Matching usa apenas: distância, reputação, performance, experiência, especialização
// - Educação não filtra workers, não prioriza candidatos
// - Por que isso NÃO pode virar decisão: matching é por atuação real, não diploma

import { reputationService } from '@core/reputation/reputation.service';
import { workInsightsService } from '../work/work-insights.service';
import { memoryService } from '@core/memory/memory.service';
import { runQueryWithTenant } from '@core/database/pool';
import type { WorkerMatch } from './instant.types';

interface RequestPayload {
  categoryId: string;
  latitude: number;
  longitude: number;
  description?: string;
}

interface WorkerWithScores extends WorkerMatch {
  distanceScore: number;
  reputationScore: number;
  performanceScore: number;
  responseScore: number;
  specializationScore: number;
  experienceScore: number;
  availabilityScore: number;
  finalScore: number;
}

class SmartMatchingService {
  /**
   * Normaliza um valor para escala 0-1
   */
  private normalize(valueCents: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Calcula score de distância (quanto mais perto, maior o score)
   */
  private calculateDistanceScore(distance: number, maxDistance: number = 10): number {
    // Inverter: distância menor = score maior
    return 1 - this.normalize(distance, 0, maxDistance);
  }

  /**
   * Busca e calcula reputationScore
   */
  private async getReputationScore(
    tenantId: string,
    workerId: string
  ): Promise<number> {
    try {
      const reputation = await reputationService.getScore(tenantId, 'worker', workerId);
      if (!reputation) {
        return 0.5; // Score neutro se não tiver reputação
      }
      // Normalizar de 0-5 para 0-1
      return this.normalize(reputation.globalScore, 0, 5);
    } catch {
      return 0.5;
    }
  }

  /**
   * Busca e calcula performanceScore
   */
  private async getPerformanceScore(
    tenantId: string,
    userId: string
  ): Promise<number> {
    try {
      const performance = await workInsightsService.getPerformance(tenantId, userId);
      if (!performance || performance.totalAssignments === 0) {
        return 0.5; // Score neutro se não tiver histórico
      }
      // Usar completionRate (0-100) e normalizar para 0-1
      return this.normalize(performance.completionRate, 0, 100);
    } catch {
      return 0.5;
    }
  }

  /**
   * Calcula responseScore baseado no Memory Engine
   * Tempo médio para aceitar requests (quanto menor, maior o score)
   */
  private async getResponseScore(
    userId: string
  ): Promise<number> {
    try {
      // Buscar contextos de assignment_completed do Memory Engine
      const contexts = memoryService.getContextsByUserId(userId, 'assignment_completed');
      
      if (contexts.length === 0) {
        return 0.5; // Score neutro se não tiver histórico
      }

      // Calcular tempo médio de resposta (placeholder)
      // Futuramente: analisar timestamps de criação vs aceitação
      // Por enquanto, usar quantidade de assignments como proxy
      const responseCount = contexts.length;
      // Mais assignments = melhor resposta (normalizar até 50 assignments)
      return this.normalize(Math.min(responseCount, 50), 0, 50);
    } catch {
      return 0.5;
    }
  }

  /**
   * Calcula specializationScore baseado em skills/categoria
   */
  private async getSpecializationScore(
    tenantId: string,
    workerId: string,
    categoryId: string
  ): Promise<number> {
    try {
      // Buscar skills do worker
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const skills = await runQueriesWithTenant<{ skill_id: string }>(
        tenantId,
        `
        SELECT skill_id
        FROM worker_skills
        WHERE worker_id = $1
        `,
        [workerId]
      );

      if (!skills || skills.length === 0) {
        return 0.3; // Score baixo se não tiver skills
      }

      // Verificar se tem skill relacionada à categoria
      // Por enquanto, usar categoryId como skillId (placeholder)
      // Futuramente: mapear categoria → skills relacionadas
      const hasMatchingSkill = skills.some((s) => s.skill_id === categoryId);
      
      if (hasMatchingSkill) {
        return 1.0; // Score máximo se tiver skill relacionada
      }

      // Score baseado em quantidade de skills (mais skills = mais versátil)
      return this.normalize(skills.length, 0, 10);
    } catch {
      return 0.5;
    }
  }

  /**
   * Calcula experienceScore baseado em assignments concluídos na categoria
   */
  private async getExperienceScore(
    tenantId: string,
    workerId: string,
    categoryId: string
  ): Promise<number> {
    try {
      // Buscar assignments completados do worker
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const assignments = await runQueriesWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*) as count
        FROM job_assignments ja
        JOIN jobs j ON j.job_id = ja.job_id
        WHERE ja.worker_id = $1
          AND ja.status = 'completed'
          AND j.required_skills @> ARRAY[$2]::uuid[]
        `,
        [workerId, categoryId]
      );

      if (!assignments || assignments.length === 0) {
        return 0.3; // Score baixo se não tiver experiência
      }

      const count = Number(assignments[0]?.count || 0);
      // Normalizar até 20 assignments (experiência considerada alta)
      return this.normalize(Math.min(count, 20), 0, 20);
    } catch {
      return 0.5;
    }
  }

  /**
   * Calcula availabilityScore baseado em lastSeen
   */
  private calculateAvailabilityScore(lastSeen: number): number {
    const now = Date.now();
    const timeSinceLastSeen = now - lastSeen;
    
    // Quanto mais recente, maior o score
    // Score máximo se lastSeen < 1 minuto
    // Score mínimo se lastSeen > 5 minutos
    const maxAge = 5 * 60 * 1000; // 5 minutos
    return 1 - this.normalize(timeSinceLastSeen, 0, maxAge);
  }

  /**
   * Ordena workers usando matching inteligente
   * Calcula múltiplos scores e faz média ponderada
   */
  async smartSortWorkers(
    workers: WorkerMatch[],
    requestPayload: RequestPayload,
    tenantId: string
  ): Promise<WorkerMatch[]> {
    if (workers.length === 0) {
      return [];
    }

    const workersWithScores: WorkerWithScores[] = [];

    // Calcular scores para cada worker
    for (const worker of workers) {
      // 1. Distance Score (0.35)
      const distanceScore = this.calculateDistanceScore(worker.distance);

      // 2. Reputation Score (0.25)
      const reputationScore = await this.getReputationScore(tenantId, worker.workerId);

      // 3. Performance Score (0.20)
      const performanceScore = await this.getPerformanceScore(tenantId, worker.userId);

      // 4. Experience Score (0.10)
      const experienceScore = await this.getExperienceScore(
        tenantId,
        worker.workerId,
        requestPayload.categoryId
      );

      // 5. Response Score (0.05)
      const responseScore = await this.getResponseScore(worker.userId);

      // 6. Specialization Score (0.05)
      const specializationScore = await this.getSpecializationScore(
        tenantId,
        worker.workerId,
        requestPayload.categoryId
      );

      // 7. Availability Score (0.05) - baseado em lastSeen do workerStatusService
      // Por enquanto, usar 1.0 (já filtrado por getOnlineWorkers)
      const availabilityScore = 1.0;

      // Calcular score final (média ponderada)
      const finalScore =
        0.35 * distanceScore +
        0.25 * reputationScore +
        0.20 * performanceScore +
        0.10 * experienceScore +
        0.05 * responseScore +
        0.05 * specializationScore +
        0.05 * availabilityScore;

      workersWithScores.push({
        ...worker,
        distanceScore,
        reputationScore,
        performanceScore,
        responseScore,
        specializationScore,
        experienceScore,
        availabilityScore,
        finalScore,
      });
    }

    // Ordenar por score final (maior primeiro)
    workersWithScores.sort((a, b) => b.finalScore - a.finalScore);

    // SPRINT 66: Retornar workers com breakdown de score explicável
    return workersWithScores.map((w) => ({
      workerId: w.workerId,
      userId: w.userId,
      distance: w.distance,
      rating: w.rating,
      estimatedTime: w.estimatedTime,
      // SPRINT 66: Incluir breakdown de score
      scoreBreakdown: {
        finalScore: w.finalScore,
        factors: [
          {
            name: 'distance',
            valueCents: w.distanceScore,
            weight: 0.35,
            contribution: w.distanceScore * 0.35,
            explanation: `Distância: ${w.distance.toFixed(2)} km`,
          },
          {
            name: 'reputation',
            valueCents: w.reputationScore,
            weight: 0.25,
            contribution: w.reputationScore * 0.25,
            explanation: `Reputação do worker`,
          },
          {
            name: 'performance',
            valueCents: w.performanceScore,
            weight: 0.20,
            contribution: w.performanceScore * 0.20,
            explanation: `Performance histórica`,
          },
          {
            name: 'experience',
            valueCents: w.experienceScore,
            weight: 0.10,
            contribution: w.experienceScore * 0.10,
            explanation: `Experiência na categoria`,
          },
          {
            name: 'response',
            valueCents: w.responseScore,
            weight: 0.05,
            contribution: w.responseScore * 0.05,
            explanation: `Tempo de resposta`,
          },
          {
            name: 'specialization',
            valueCents: w.specializationScore,
            weight: 0.05,
            contribution: w.specializationScore * 0.05,
            explanation: `Especialização`,
          },
          {
            name: 'availability',
            valueCents: w.availabilityScore,
            weight: 0.05,
            contribution: w.availabilityScore * 0.05,
            explanation: `Disponibilidade`,
          },
        ],
        explanation: `Score final calculado pela média ponderada de 7 fatores`,
      },
    }));
  }
}

export const smartMatchingService = new SmartMatchingService();


