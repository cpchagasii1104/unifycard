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
  breakEvenMonthlyServices: number; // Número de serviços necessários para cobrir custos fixos
  breakEvenMonthlyRevenue: { amountCents: number; currency: string }; // Receita necessária para cobrir custos fixos
  currentMonthlyServices: number; // Serviços executados no mês
  currentMonthlyRevenue: { amountCents: number; currency: string }; // Receita do mês
  marginToBreakEven: number; // Diferença entre receita atual e break-even (pode ser negativa)
  isAboveBreakEven: boolean; // Se está acima do ponto de equilíbrio
  calculatedAt: string;
  immutable: true;
}

/**
 * Análise de margem por serviço
 */
export interface ServiceMarginAnalysis {
  serviceOfferingId: string;
  serviceName: string;
  averagePrice: { amountCents: number; currency: string }; // Preço médio real
  averageCost: { amountCents: number; currency: string }; // Custo médio real (variável + proporcional fixo)
  marginPerService: { amountCents: number; currency: string }; // Margem por serviço
  marginPercentage: number; // Margem percentual
  isProfitable: boolean; // Se o serviço é lucrativo
  servicesExecutedCount: number; // Quantidade de serviços executados
  totalRevenue: { amountCents: number; currency: string }; // Receita total do serviço
  totalCost: { amountCents: number; currency: string }; // Custo total do serviço
  calculatedAt: string;
  immutable: true;
}

/**
 * Perfil de custo operacional (consolidado)
 */
export interface OperationalCostProfile {
  storeId: string;
  companyId: string;
  
  // Custos fixos mensais
  fixedCostsMonthly: {
    rent?: { amountCents: number; currency: string };
    salaries?: { amountCents: number; currency: string };
    proLabore?: { amountCents: number; currency: string };
    systems?: { amountCents: number; currency: string };
    other?: { amountCents: number; currency: string };
    totalCents: { amountCents: number; currency: string };
  };
  
  // Custos variáveis (por serviço)
  variableCostsPerService: {
    materials?: { amountCents: number; currency: string };
    commission?: { amountCents: number; currency: string };
    transportation?: { amountCents: number; currency: string };
    other?: { amountCents: number; currency: string };
    averagePerService: { amountCents: number; currency: string };
  };
  
  // Custos por hora (se aplicável)
  costsPerHour?: {
    fixedCostPerHour: { amountCents: number; currency: string }; // Custo fixo proporcional por hora
    variableCostPerHour: { amountCents: number; currency: string }; // Custo variável por hora
    totalCostPerHour: { amountCents: number; currency: string };
  };
  
  // Origem dos dados
  dataSource: {
    declared: boolean; // Se os custos foram declarados pela empresa
    historical: boolean; // Se os custos foram inferidos do histórico
    lastUpdated: string;
  };
  
  calculatedAt: string;
  immutable: false; // Perfil pode ser atualizado
}

/**
 * Leitura de operação real
 */
export interface RealOperationMetrics {
  storeId: string;
  companyId: string;
  period: {
    start: string;
    end: string;
  };
  
  // Métricas de receita
  averageTicket: { amountCents: number; currency: string }; // Ticket médio real
  totalRevenue: { amountCents: number; currency: string }; // Receita total do período
  totalServices: number; // Total de serviços executados
  
  // Métricas de tempo
  averageExecutionTimeMinutes: number; // Tempo médio de execução
  averageResponseTimeMinutes: number; // Tempo médio de resposta
  
  // Métricas de cancelamento
  cancellationRate: number; // Taxa de cancelamento (0-1)
  cancelledServicesCount: number; // Quantidade de serviços cancelados
  totalRequestsCount: number; // Total de requests (incluindo cancelados)
  
  // Análise de lucratividade
  servicesAtLoss: number; // Serviços executados no prejuízo
  servicesAtLossPercentage: number; // Percentual de serviços no prejuízo
  totalLossAmount: { amountCents: number; currency: string }; // Valor total perdido
  
  calculatedAt: string;
  immutable: true;
}

/**
 * Relatório de precificação assistida (privado, não prescritivo)
 */
export interface PricingAssistanceReport {
  reportId: string;
  storeId: string;
  companyId: string;
  actorId: string; // Dono/gestor que pode ver este relatório
  
  period: {
    start: string;
    end: string;
  };
  
  // Perfil de custo
  costProfile: OperationalCostProfile;
  
  // Leitura de operação real
  operationMetrics: RealOperationMetrics;
  
  // Análise de ponto de equilíbrio
  breakEvenAnalysis: BreakEvenAnalysis;
  
  // Análise de margem por serviço
  serviceMargins: ServiceMarginAnalysis[];
  
  // Margem média mensal
  averageMonthlyMargin: {
    totalRevenue: { amountCents: number; currency: string };
    totalCost: { amountCents: number; currency: string };
    margin: { amountCents: number; currency: string };
    marginPercentage: number;
  };
  
  // Risco operacional
  operationalRisk: OperationalRiskLevel;
  riskFactors: string[]; // Fatores que contribuem para o risco
  
  // Alertas silenciosos (não prescritivos)
  alerts: Array<{
    type: 'operating_at_loss' | 'below_break_even' | 'high_cancellation_rate' | 'low_margin_services';
    message: string; // Mensagem descritiva, não prescritiva
    severity: 'info' | 'warning' | 'critical';
  }>;
  
  // Regras rígidas aplicadas
  governance: {
    noPriceSuggestion: true; // Nunca sugere preço
    noCatalogModification: true; // Nunca altera catálogo
    noMatchingInterference: true; // Nunca interfere em matching
    privateOnly: true; // Apenas leitura privada
  };
  
  generatedAt: string;
  immutable: true; // Relatórios são imutáveis (snapshots)
}





