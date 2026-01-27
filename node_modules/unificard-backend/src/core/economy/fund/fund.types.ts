// src/core/economy/fund/fund.types.ts
// DTOs claros e explícitos para visibilidade do Fundo Regional
// READ-ONLY: apenas expõe dados, não cria decisão ou execução

/**
 * Resumo do Fundo Regional
 * Dados explícitos sobre o estado atual do fundo
 */
export interface RegionalFundSummary {
  // Identificação (omitido se regionId === "unknown")
  regionId?: string;
  regionName?: string;

  // Estado atual
  currentBalance: number; // Saldo atual em reais (BRL)

  // Estatísticas
  totalContributions: number; // Total de transações que contribuíram para o fundo
  totalReceived: number; // Total que entrou no fundo (historicamente)

  // Fontes (de onde veio o dinheiro)
  fromServices: {
    work: number; // Total vindo de serviços prestados
    // Futuramente: rides, marketplace, etc.
  };

  // Metadados
  lastUpdated: string; // ISO date da última atualização

  // Texto fixo explicativo (hardcoded, proposital)
  explanation: {
    text: string; // "10% de cada transação nesta cidade vai para o Fundo Regional."
    example: string; // "Exemplo: se uma transação for R$ 100, R$ 10 vai para o fundo."
  };

  // Como o dinheiro é dividido (split completo)
  // Mostra transparência total: de cada R$ 100, para onde vai
  // Valores em percentual (70 = 70%, 15 = 15%, etc)
  splitBreakdown: {
    worker: number; // 70 - vai para o trabalhador
    platform: number; // 15 - vai para a plataforma
    regionalFund: number; // 10 - vai para o fundo regional
    community: number; // 5 - vai para a comunidade
  };
}

/**
 * Entrada do histórico do fundo
 * Agregado por dia
 */
export interface RegionalFundHistoryEntry {
  date: string; // YYYY-MM-DD
  amount: number; // Valor que entrou neste dia
  transactionCount: number; // Quantas transações contribuíram
}

/**
 * Histórico do Fundo Regional
 */
export interface RegionalFundHistory {
  regionId?: string; // Omitido se "unknown"
  entries: RegionalFundHistoryEntry[];
  period: {
    start: string; // ISO date
    end: string; // ISO date
    days: number;
    label: string; // "Últimos 30 dias", "Últimos 90 dias", etc
  };
  totalInPeriod: number; // Total acumulado no período
}

/**
 * Projeção do Fundo Regional
 * Baseada em média diária dos últimos 30 dias
 */
export interface RegionalFundProjection {
  regionId?: string; // Omitido se "unknown"
  currentBalance: number;
  dailyAverage: number; // Média diária dos últimos 30 dias
  daysAnalyzed: number; // Quantos dias foram analisados

  // Estimativas lineares (assumindo média constante)
  // IMPORTANTE: são apenas estimativas, não garantias
  estimates: {
    in30Days: {
      estimatedBalance: number; // Saldo estimado em 30 dias
      estimatedIncrease: number; // Quanto deve aumentar em 30 dias
    };
    in90Days: {
      estimatedBalance: number; // Saldo estimado em 90 dias
      estimatedIncrease: number; // Quanto deve aumentar em 90 dias
    };
  };

  // Metadados
  calculatedAt: string; // ISO date
  disclaimer: string; // "Estimativa baseada na média dos últimos dias. Valores reais podem ser diferentes."
}

/**
 * Visão completa do Fundo Regional
 * Combina resumo, histórico e projeção
 */
export interface RegionalFundView {
  summary: RegionalFundSummary;
  history: RegionalFundHistory;
  projection: RegionalFundProjection;
}

