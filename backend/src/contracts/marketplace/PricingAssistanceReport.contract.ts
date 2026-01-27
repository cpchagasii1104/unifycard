// CONTRATO PÚBLICO CONGELADO - PricingAssistanceReport (Relatório de Precificação Assistida)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Risco operacional
 */
export type OperationalRiskLevel = 'low' | 'medium' | 'high';

/**
 * Análise de ponto de equilíbrio
 */
export interface BreakEvenAnalysis {
  break_even_monthly_services: number; // Número de serviços necessários para cobrir custos fixos
  break_even_monthly_revenue: { amount: number; currency: string }; // Receita necessária para cobrir custos fixos
  current_monthly_services: number; // Serviços executados no mês
  current_monthly_revenue: { amount: number; currency: string }; // Receita do mês
  margin_to_break_even: number; // Diferença entre receita atual e break-even (pode ser negativa)
  is_above_break_even: boolean; // Se está acima do ponto de equilíbrio
  calculated_at: string;
  immutable: true;
}

/**
 * Análise de margem por serviço
 */
export interface ServiceMarginAnalysis {
  service_offering_id: string;
  service_name: string;
  average_price: { amount: number; currency: string }; // Preço médio real
  average_cost: { amount: number; currency: string }; // Custo médio real (variável + proporcional fixo)
  margin_per_service: { amount: number; currency: string }; // Margem por serviço
  margin_percentage: number; // Margem percentual
  is_profitable: boolean; // Se o serviço é lucrativo
  services_executed_count: number; // Quantidade de serviços executados
  total_revenue: { amount: number; currency: string }; // Receita total do serviço
  total_cost: { amount: number; currency: string }; // Custo total do serviço
  calculated_at: string;
  immutable: true;
}

/**
 * Perfil de custo operacional (consolidado)
 */
export interface OperationalCostProfile {
  store_id: string;
  company_id: string;
  
  // Custos fixos mensais
  fixed_costs_monthly: {
    rent?: { amount: number; currency: string };
    salaries?: { amount: number; currency: string };
    pro_labore?: { amount: number; currency: string };
    systems?: { amount: number; currency: string };
    other?: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  
  // Custos variáveis (por serviço)
  variable_costs_per_service: {
    materials?: { amount: number; currency: string };
    commission?: { amount: number; currency: string };
    transportation?: { amount: number; currency: string };
    other?: { amount: number; currency: string };
    average_per_service: { amount: number; currency: string };
  };
  
  // Custos por hora (se aplicável)
  costs_per_hour?: {
    fixed_cost_per_hour: { amount: number; currency: string }; // Custo fixo proporcional por hora
    variable_cost_per_hour: { amount: number; currency: string }; // Custo variável por hora
    total_cost_per_hour: { amount: number; currency: string };
  };
  
  // Origem dos dados
  data_source: {
    declared: boolean; // Se os custos foram declarados pela empresa
    historical: boolean; // Se os custos foram inferidos do histórico
    last_updated: string;
  };
  
  calculated_at: string;
  immutable: false; // Perfil pode ser atualizado
}

/**
 * Leitura de operação real
 */
export interface RealOperationMetrics {
  store_id: string;
  company_id: string;
  period: {
    start: string;
    end: string;
  };
  
  // Métricas de receita
  average_ticket: { amount: number; currency: string }; // Ticket médio real
  total_revenue: { amount: number; currency: string }; // Receita total do período
  total_services: number; // Total de serviços executados
  
  // Métricas de tempo
  average_execution_time_minutes: number; // Tempo médio de execução
  average_response_time_minutes: number; // Tempo médio de resposta
  
  // Métricas de cancelamento
  cancellation_rate: number; // Taxa de cancelamento (0-1)
  cancelled_services_count: number; // Quantidade de serviços cancelados
  total_requests_count: number; // Total de requests (incluindo cancelados)
  
  // Análise de lucratividade
  services_at_loss: number; // Serviços executados no prejuízo
  services_at_loss_percentage: number; // Percentual de serviços no prejuízo
  total_loss_amount: { amount: number; currency: string }; // Valor total perdido
  
  calculated_at: string;
  immutable: true;
}

/**
 * Relatório de precificação assistida (privado, não prescritivo)
 */
export interface PricingAssistanceReport {
  report_id: string;
  store_id: string;
  company_id: string;
  actor_id: string; // Dono/gestor que pode ver este relatório
  
  period: {
    start: string;
    end: string;
  };
  
  // Perfil de custo
  cost_profile: OperationalCostProfile;
  
  // Leitura de operação real
  operation_metrics: RealOperationMetrics;
  
  // Análise de ponto de equilíbrio
  break_even_analysis: BreakEvenAnalysis;
  
  // Análise de margem por serviço
  service_margins: ServiceMarginAnalysis[];
  
  // Margem média mensal
  average_monthly_margin: {
    total_revenue: { amount: number; currency: string };
    total_cost: { amount: number; currency: string };
    margin: { amount: number; currency: string };
    margin_percentage: number;
  };
  
  // Risco operacional
  operational_risk: OperationalRiskLevel;
  risk_factors: string[]; // Fatores que contribuem para o risco
  
  // Alertas silenciosos (não prescritivos)
  alerts: Array<{
    type: 'operating_at_loss' | 'below_break_even' | 'high_cancellation_rate' | 'low_margin_services';
    message: string; // Mensagem descritiva, não prescritiva
    severity: 'info' | 'warning' | 'critical';
  }>;
  
  // Regras rígidas aplicadas
  governance: {
    no_price_suggestion: true; // Nunca sugere preço
    no_catalog_modification: true; // Nunca altera catálogo
    no_matching_interference: true; // Nunca interfere em matching
    private_only: true; // Apenas leitura privada
  };
  
  generated_at: string;
  immutable: true; // Relatórios são imutáveis (snapshots)
}




