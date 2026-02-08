// backend/src/contracts/marketplace/ServiceEvaluation.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceEvaluation (Avaliação Pós-Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceEvaluation - Avaliação Pós-Serviço Bidirecional
 * 
 * Sistema de avaliação obrigatória, bidirecional e determinístico
 * após a conclusão de serviços.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceEvaluation {
  evaluationId: string;
  requestId: string;
  evaluatorType: 'user' | 'provider';
  evaluatorActorId: string;
  targetActorId: string;
  scores: {
    executionQuality: number; // 1-5
    punctuality: number; // 1-5
    communication: number; // 1-5
    compliance: number; // 1-5
  };
  createdAt: string;
  // Imutável após criação
  immutable: true;
}

export interface EvaluationAggregate {
  actorId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalEvaluations: number;
  averageScores: {
    executionQuality: number;
    punctuality: number;
    communication: number;
    compliance: number;
  };
  overallAverage: number;
  lowScoreCount: number; // Quantidade de avaliações com média < 3
  trend: 'improving' | 'stable' | 'declining';
}





