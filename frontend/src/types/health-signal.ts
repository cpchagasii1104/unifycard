// frontend/src/types/health-signal.ts
// CONTINUOUS PRODUCTION: Tipos de Sinais de Saúde - SPRINT 9
// Modelo de sinais simples baseados em dados reais

export type HealthStatus = 'healthy' | 'attention' | 'critical';

export type HealthSignalType =
  | 'recent_activity'
  | 'no_recent_activity'
  | 'stable_earnings'
  | 'declining_activity'
  | 'active_members'
  | 'no_members'
  | 'group_contributions'
  | 'financial_movement';

export interface HealthSignal {
  id: string;
  type: HealthSignalType;
  status: HealthStatus;
  title: string; // Título descritivo
  description: string; // Explicação do sinal
  observation: string; // Observação neutra (não avaliativa)
  source: string; // Origem do sinal (ex: "Baseado em transações dos últimos 30 dias")
  createdAt: string; // Timestamp da detecção
  metadata?: Record<string, any>; // Dados adicionais (ex: lastActivityDate, transactionCount)
}







