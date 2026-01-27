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
  evaluation_id: string;
  request_id: string;
  evaluator_type: 'user' | 'provider';
  evaluator_actor_id: string;
  target_actor_id: string;
  scores: {
    execution_quality: number; // 1-5
    punctuality: number; // 1-5
    communication: number; // 1-5
    compliance: number; // 1-5
  };
  created_at: string;
  // Imutável após criação
  immutable: true;
}

export interface EvaluationAggregate {
  actor_id: string;
  period: {
    start_date: string;
    end_date: string;
  };
  total_evaluations: number;
  average_scores: {
    execution_quality: number;
    punctuality: number;
    communication: number;
    compliance: number;
  };
  overall_average: number;
  low_score_count: number; // Quantidade de avaliações com média < 3
  trend: 'improving' | 'stable' | 'declining';
}





