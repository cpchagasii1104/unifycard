// frontend/src/types/workflow.ts
// CONTINUOUS PRODUCTION: Tipos de Workflow - SPRINT 7
// Modelo de fluxos reais de trabalho baseados em estado real

export type WorkflowStatus = 'available' | 'blocked' | 'completed' | 'not_applicable';

export type WorkflowId =
  | 'onboard_company'
  | 'onboard_group'
  | 'delegate_and_act'
  | 'earn_and_understand_money';

export interface WorkflowStep {
  id: string;
  title: string; // Título do passo
  description: string; // Explicação do que fazer
  action?: {
    label: string; // Texto do botão/ação
    path?: string; // Rota para executar
    onClick?: () => void; // Callback alternativo
  };
  isRequired: boolean; // Se o passo é obrigatório
  isCompleted: boolean; // Se o passo já foi completado
  isBlocked: boolean; // Se o passo está bloqueado
  blockingReason?: string; // Por que está bloqueado
}

export interface Workflow {
  id: WorkflowId;
  title: string; // Título do workflow
  description: string; // Explicação do objetivo do fluxo
  status: WorkflowStatus;
  currentStepIndex: number; // Índice do passo atual (0-based)
  steps: WorkflowStep[];
  metadata?: Record<string, any>; // Dados adicionais
}







