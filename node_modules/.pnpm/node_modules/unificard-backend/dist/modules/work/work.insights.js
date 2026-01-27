"use strict";
// src/modules/work/work.insights.ts
//
// Funções de leitura de insights do módulo Work
// Acessa dados do Memory Engine para gerar análises inteligentes
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestSummaries = getLatestSummaries;
exports.getJobHistory = getJobHistory;
exports.getPerformanceScore = getPerformanceScore;
exports.getWorkPatterns = getWorkPatterns;
const memory_service_1 = require("@core/memory/memory.service");
/**
 * Busca os últimos resumos de sessões de trabalho
 */
async function getLatestSummaries(userId, limit = 5) {
    const contexts = memory_service_1.memoryService.getContextsByUserId(userId, 'work_session_summary');
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
async function getJobHistory(userId, limit = 20) {
    const contexts = memory_service_1.memoryService.getContextsByUserId(userId, 'job_created');
    return contexts.slice(0, limit).map((entry) => ({
        jobId: entry.data.jobId || '',
        timestamp: entry.data.timestamp || new Date(entry.timestamp).toISOString(),
        status: entry.data.status,
    }));
}
/**
 * Calcula score de performance do usuário
 */
async function getPerformanceScore(userId) {
    const completedContexts = memory_service_1.memoryService.getContextsByUserId(userId, 'assignment_completed');
    const createdContexts = memory_service_1.memoryService.getContextsByUserId(userId, 'assignment_created');
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
async function getWorkPatterns(userId) {
    const completedContexts = memory_service_1.memoryService.getContextsByUserId(userId, 'assignment_completed');
    // Analisar horários preferidos
    const hourCounts = {};
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
    const mostFrequentJobTypes = [];
    return {
        preferredHours,
        averageSessionDuration,
        mostFrequentJobTypes,
    };
}
