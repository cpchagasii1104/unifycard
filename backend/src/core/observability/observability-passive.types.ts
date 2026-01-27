// src/core/observability/observability-passive.types.ts
// Tipos para Observabilidade Passiva (Contratos O-01 a O-06)
// 🔴 BLINDAGEM: Observabilidade NÃO dispara ações
// 🔴 BLINDAGEM: Observabilidade NÃO altera estado de domínio
// 🔴 BLINDAGEM: Observabilidade apenas calcula métricas agregadas

/**
 * O-01: DENSIDADE COGNITIVA
 * Observa carga decisória agregada (nunca indivíduos)
 * 
 * O QUE MEDE:
 * - Intensidade de decisões tomadas no sistema (agregado)
 * - Carga cognitiva coletiva (não individual)
 * 
 * O QUE NÃO MEDE:
 * - Eficiência de decisões
 * - Qualidade de decisões
 * - Identidade de quem decidiu
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Disparar ações baseadas em densidade
 * - Bloquear decisões quando densidade é alta
 * - Identificar indivíduos específicos
 * - Gerar alertas automáticos
 */
export interface CognitiveDensitySignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'hour' | 'day' | 'week' | 'month';
  totalDecisionsCount: number;
  uniqueActorsCount: number;
  averageDecisionsPerActor: number;
  cognitiveDensityIndex: number; // 0-1: intensidade de carga decisória
  domainType?: string;
  intentType?: string;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * O-02: NORMALIZAÇÃO
 * Observa perda de variação comportamental (nunca eficiência)
 * 
 * O QUE MEDE:
 * - Variação de comportamentos no sistema
 * - Entropia comportamental (diversidade de ações)
 * 
 * O QUE NÃO MEDE:
 * - Eficiência de processos
 * - Otimização de fluxos
 * - Performance individual
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Forçar normalização quando variação é alta
 * - Penalizar variação comportamental
 * - Disparar ações baseadas em normalização
 */
export interface NormalizationSignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'hour' | 'day' | 'week' | 'month';
  totalActionsCount: number;
  uniqueActionTypesCount: number;
  uniqueBehavioralPatternsCount: number;
  variationIndex: number; // 0-1: 0 = totalmente normalizado, 1 = máxima variação
  entropyScore: number; // Entropia comportamental (Shannon)
  domainType?: string;
  actionCategory?: string;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * O-03: CONCENTRAÇÃO HUMANA
 * Observa centralidade emergente (nunca nomeia pessoas)
 * 
 * O QUE MEDE:
 * - Distribuição de interações no sistema
 * - Centralidade emergente (sem identificar quem)
 * - Coeficiente de Gini de interações
 * 
 * O QUE NÃO MEDE:
 * - Identidade de pessoas específicas
 * - Performance individual
 * - Reputação de atores
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Nomear pessoas específicas
 * - Criar ranking de atores
 * - Disparar ações baseadas em concentração
 * - Penalizar centralidade
 */
export interface HumanConcentrationSignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'hour' | 'day' | 'week' | 'month';
  totalInteractionsCount: number;
  uniqueActorsCount: number;
  giniCoefficient: number; // 0 = igualdade, 1 = concentração máxima
  concentrationIndex: number; // 0-1: intensidade de concentração
  topPercentileShare?: number; // Participação do top 10% (sem identificar quem)
  interactionType?: string;
  domainType?: string;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * O-04: VISIBILIDADE
 * Observa distribuição de atenção (nunca rebalanceia feed)
 * 
 * O QUE MEDE:
 * - Distribuição de visualizações/atenção
 * - Gini da distribuição de atenção
 * - Participação da cauda longa
 * 
 * O QUE NÃO MEDE:
 * - Qualidade de conteúdo
 * - Relevância de itens
 * - Performance de posts
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Rebalancear feed automaticamente
 * - Alterar ordem de exibição
 * - Promover/demover conteúdo
 * - Disparar ações baseadas em visibilidade
 */
export interface VisibilitySignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'hour' | 'day' | 'week' | 'month';
  totalViewsCount: number;
  uniqueContentItemsCount: number;
  uniqueViewersCount: number;
  attentionGiniCoefficient: number; // Gini da distribuição de atenção
  visibilityIndex: number; // 0-1: 0 = atenção concentrada, 1 = atenção distribuída
  longTailShare?: number; // Participação da cauda longa (sem identificar itens)
  contentType?: string;
  feedSection?: string;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * O-05: QUEBRA DE PADRÃO
 * Permite variação semântica neutra (nunca induz escolha)
 * 
 * O QUE MEDE:
 * - Variação semântica de ações
 * - Quebras de padrão comportamental
 * - Diversidade de escolhas
 * 
 * O QUE NÃO MEDE:
 * - Correção de padrões
 * - Eficiência de escolhas
 * - Qualidade de decisões
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Induzir escolhas específicas
 * - Penalizar quebras de padrão
 * - Forçar normalização
 * - Disparar ações baseadas em quebra de padrão
 */
export interface PatternBreakSignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'hour' | 'day' | 'week' | 'month';
  totalActionsCount: number;
  expectedPatternActionsCount: number;
  patternBreakActionsCount: number;
  patternBreakIndex: number; // 0-1: intensidade de quebra de padrão
  semanticVariationScore: number; // Variação semântica (semântica neutra)
  domainType?: string;
  patternType?: string;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * O-06: MEMÓRIA TEMPORAL
 * Observa tendências longas (nunca moraliza passado)
 * 
 * O QUE MEDE:
 * - Tendências temporais de métricas
 * - Direção e força de tendências
 * - Médias móveis
 * 
 * O QUE NÃO MEDE:
 * - Correção de comportamento passado
 * - Justiça de decisões históricas
 * - Moralidade de ações anteriores
 * 
 * O QUE NUNCA PODE SER FEITO:
 * - Moralizar passado
 * - Penalizar tendências históricas
 * - Disparar ações baseadas em tendências
 * - Corrigir comportamento baseado em memória
 */
export interface TemporalMemorySignal {
  signalId: string;
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  windowType: 'week' | 'month' | 'quarter' | 'year';
  metricType: string; // Tipo de métrica observada
  metricValue: number; // Valor da métrica no período
  previousPeriodValue?: number; // Valor do período anterior
  trendDirection?: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  trendStrength: number; // 0-1: força da tendência
  movingAverage?: number; // Média móvel (se aplicável)
  domainType?: string;
  aggregationLevel?: 'tenant' | 'city' | 'global';
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computedAt: Date;
}

/**
 * Tipo união para todos os sinais
 */
export type ObservabilitySignal =
  | CognitiveDensitySignal
  | NormalizationSignal
  | HumanConcentrationSignal
  | VisibilitySignal
  | PatternBreakSignal
  | TemporalMemorySignal;

/**
 * Tipo de sinal
 */
export enum ObservabilitySignalType {
  COGNITIVE_DENSITY = 'cognitive_density', // O-01
  NORMALIZATION = 'normalization', // O-02
  HUMAN_CONCENTRATION = 'human_concentration', // O-03
  VISIBILITY = 'visibility', // O-04
  PATTERN_BREAK = 'pattern_break', // O-05
  TEMPORAL_MEMORY = 'temporal_memory', // O-06
}

