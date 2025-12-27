// src/modules/work/work.insights.ts
//
// Funções de leitura de insights do módulo Work
// Acessa dados do Memory Engine para gerar análises inteligentes

import { memoryService } from '@core/memory/memory.service';

export interface WorkSummary {
  summary: string;
  jobId: string;
  assignmentId: string;
  timestamp: string;
}

export interface JobHistoryEntry {
  jobId: string;
  timestamp: string;
  status?: string;
}

export interface PerformanceScore {
  score: number;
  completedAssignments: number;
  totalAssignments: number;
  completionRate: number;
}

export interface WorkPatterns {
  preferredHours: Array<{ hour: number; count: number }>;
  averageSessionDuration?: number;
  mostFrequentJobTypes: Array<{ type: string; count: number }>;
}

/**
 * Busca os últimos resumos de sessões de trabalho
 */
export async function getLatestSummaries(
  userId: string,
  limit: number = 5
): Promise<WorkSummary[]> {
  const contexts = memoryService.getContextsByUserId(userId, 'work_session_summary');
  
  return contexts.slice(0, limit).map((entry) => ({
    summary: entry.data.summary || '',
    jobId: entry.data.jobId || '',
    assignmentId: entry.data.assignmentId || '',
    timestamp: entry.data.timestamp || new Date(entry.timestamp).toISOString(),
  }));
}

/**
 * Busca histórico de jobs criados pelo usuário
 */
export async function getJobHistory(
  userId: string,
  limit: number = 20
): Promise<JobHistoryEntry[]> {
  const contexts = memoryService.getContextsByUserId(userId, 'job_created');
  
  return contexts.slice(0, limit).map((entry) => ({
    jobId: entry.data.jobId || '',
    timestamp: entry.data.timestamp || new Date(entry.timestamp).toISOString(),
    status: entry.data.status,
  }));
}

/**
 * Calcula score de performance do usuário
 */
export async function getPerformanceScore(userId: string): Promise<PerformanceScore> {
  const completedContexts = memoryService.getContextsByUserId(userId, 'assignment_completed');
  const createdContexts = memoryService.getContextsByUserId(userId, 'assignment_created');
  
  const completedAssignments = completedContexts.length;
  const totalAssignments = createdContexts.length;
  
  const completionRate = totalAssignments > 0 
    ? (completedAssignments / totalAssignments) * 100 
    : 0;
  
  return {
    score: Math.round(completionRate),
    completedAssignments,
    totalAssignments,
    completionRate: Math.round(completionRate * 100) / 100,
  };
}

/**
 * Detecta padrões de trabalho do usuário
 */
export async function getWorkPatterns(userId: string): Promise<WorkPatterns> {
  const completedContexts = memoryService.getContextsByUserId(userId, 'assignment_completed');
  
  // Analisar horários preferidos
  const hourCounts: Record<number, number> = {};
  completedContexts.forEach((entry) => {
    if (entry.data.timestamp) {
      const date = new Date(entry.data.timestamp);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  
  const preferredHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Calcular duração média (placeholder - precisa de dados de início/fim)
  // Por enquanto, retornamos undefined
  const averageSessionDuration = undefined;
  
  // Analisar tipos de job mais frequentes
  // Por enquanto, retornamos array vazio (precisa de mais dados)
  const mostFrequentJobTypes: Array<{ type: string; count: number }> = [];
  
  return {
    preferredHours,
    averageSessionDuration,
    mostFrequentJobTypes,
  };
}








