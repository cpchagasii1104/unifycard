-- ============================================================
-- UNIFICARD — OBSERVABILIDADE PASSIVA
-- Arquivo: 148_observability_passive.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar estrutura técnica para observabilidade passiva
-- conforme contratos O-01 a O-06
--
-- REGRAS ABSOLUTAS:
-- * Observabilidade NÃO dispara ações
-- * Observabilidade NÃO gera alertas
-- * Observabilidade NÃO altera estado de domínio
-- * Observabilidade apenas calcula métricas agregadas
-- * Observabilidade apenas armazena séries temporais
--
-- ============================================================

BEGIN;

-- ============================================================
-- O-01: DENSIDADE COGNITIVA
-- Observa carga decisória agregada (nunca indivíduos)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_cognitive_density (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'hour', -- hour, day, week, month
  
  -- Métricas agregadas
  total_decisions_count BIGINT NOT NULL DEFAULT 0, -- Total de decisões no período
  unique_actors_count BIGINT NOT NULL DEFAULT 0, -- Atores únicos que tomaram decisões
  average_decisions_per_actor NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Média de decisões por ator
  
  -- Densidade (carga decisória)
  cognitive_density_index NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: intensidade de carga decisória
  
  -- Contexto (sem identificar indivíduos)
  domain_type VARCHAR(50), -- 'booking', 'payment', 'availability', etc.
  intent_type VARCHAR(50), -- Tipo de intent mais frequente
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0, -- Tamanho da amostra
  confidence VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low', 'insufficient'
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices
  CONSTRAINT uniq_cognitive_density_window UNIQUE (tenant_id, window_start, window_end, window_type, domain_type)
);

CREATE INDEX IF NOT EXISTS idx_cognitive_density_tenant_window ON observability_cognitive_density (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_cognitive_density_computed_at ON observability_cognitive_density (computed_at);

COMMENT ON TABLE observability_cognitive_density IS 
'O-01: Densidade Cognitiva - Observa carga decisória agregada. NUNCA identifica indivíduos. NUNCA dispara ações.';

-- ============================================================
-- O-02: NORMALIZAÇÃO
-- Observa perda de variação comportamental (nunca eficiência)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_normalization (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'day',
  
  -- Métricas de variação comportamental
  total_actions_count BIGINT NOT NULL DEFAULT 0, -- Total de ações no período
  unique_action_types_count BIGINT NOT NULL DEFAULT 0, -- Tipos únicos de ações
  unique_behavioral_patterns_count BIGINT NOT NULL DEFAULT 0, -- Padrões comportamentais únicos
  
  -- Normalização (perda de variação)
  variation_index NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: 0 = totalmente normalizado, 1 = máxima variação
  entropy_score NUMERIC(10, 6) NOT NULL DEFAULT 0, -- Entropia comportamental (Shannon)
  
  -- Contexto
  domain_type VARCHAR(50), -- Domínio observado
  action_category VARCHAR(50), -- Categoria de ação mais frequente
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uniq_normalization_window UNIQUE (tenant_id, window_start, window_end, window_type, domain_type)
);

CREATE INDEX IF NOT EXISTS idx_normalization_tenant_window ON observability_normalization (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_normalization_computed_at ON observability_normalization (computed_at);

COMMENT ON TABLE observability_normalization IS 
'O-02: Normalização - Observa perda de variação comportamental. NUNCA mede eficiência. NUNCA dispara ações.';

-- ============================================================
-- O-03: CONCENTRAÇÃO HUMANA
-- Observa centralidade emergente (nunca nomeia pessoas)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_human_concentration (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'day',
  
  -- Métricas de centralidade (sem identificar indivíduos)
  total_interactions_count BIGINT NOT NULL DEFAULT 0, -- Total de interações
  unique_actors_count BIGINT NOT NULL DEFAULT 0, -- Atores únicos
  gini_coefficient NUMERIC(5, 4) NOT NULL DEFAULT 0, -- Coeficiente de Gini (0 = igualdade, 1 = concentração máxima)
  
  -- Concentração
  concentration_index NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: intensidade de concentração
  top_percentile_share NUMERIC(5, 4), -- Participação do top 10% (sem identificar quem)
  
  -- Contexto
  interaction_type VARCHAR(50), -- Tipo de interação observada
  domain_type VARCHAR(50), -- Domínio observado
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uniq_concentration_window UNIQUE (tenant_id, window_start, window_end, window_type, interaction_type)
);

CREATE INDEX IF NOT EXISTS idx_concentration_tenant_window ON observability_human_concentration (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_concentration_computed_at ON observability_human_concentration (computed_at);

COMMENT ON TABLE observability_human_concentration IS 
'O-03: Concentração Humana - Observa centralidade emergente. NUNCA nomeia pessoas. NUNCA dispara ações.';

-- ============================================================
-- O-04: VISIBILIDADE
-- Observa distribuição de atenção (nunca rebalanceia feed)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_visibility (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'hour',
  
  -- Métricas de distribuição de atenção
  total_views_count BIGINT NOT NULL DEFAULT 0, -- Total de visualizações
  unique_content_items_count BIGINT NOT NULL DEFAULT 0, -- Itens de conteúdo únicos visualizados
  unique_viewers_count BIGINT NOT NULL DEFAULT 0, -- Visualizadores únicos
  
  -- Distribuição de atenção
  attention_gini_coefficient NUMERIC(5, 4) NOT NULL DEFAULT 0, -- Gini da distribuição de atenção
  visibility_index NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: 0 = atenção concentrada, 1 = atenção distribuída
  long_tail_share NUMERIC(5, 4), -- Participação da cauda longa (sem identificar itens)
  
  -- Contexto
  content_type VARCHAR(50), -- 'post', 'event', 'service', etc.
  feed_section VARCHAR(50), -- Seção do feed (se aplicável)
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uniq_visibility_window UNIQUE (tenant_id, window_start, window_end, window_type, content_type)
);

CREATE INDEX IF NOT EXISTS idx_visibility_tenant_window ON observability_visibility (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_visibility_computed_at ON observability_visibility (computed_at);

COMMENT ON TABLE observability_visibility IS 
'O-04: Visibilidade - Observa distribuição de atenção. NUNCA rebalanceia feed. NUNCA dispara ações.';

-- ============================================================
-- O-05: QUEBRA DE PADRÃO
-- Permite variação semântica neutra (nunca induz escolha)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_pattern_break (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'day',
  
  -- Métricas de variação semântica
  total_actions_count BIGINT NOT NULL DEFAULT 0, -- Total de ações
  expected_pattern_actions_count BIGINT NOT NULL DEFAULT 0, -- Ações que seguem padrão esperado
  pattern_break_actions_count BIGINT NOT NULL DEFAULT 0, -- Ações que quebram padrão
  
  -- Quebra de padrão
  pattern_break_index NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: intensidade de quebra de padrão
  semantic_variation_score NUMERIC(10, 6) NOT NULL DEFAULT 0, -- Variação semântica (semântica neutra)
  
  -- Contexto
  domain_type VARCHAR(50), -- Domínio observado
  pattern_type VARCHAR(50), -- Tipo de padrão observado
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uniq_pattern_break_window UNIQUE (tenant_id, window_start, window_end, window_type, domain_type, pattern_type)
);

CREATE INDEX IF NOT EXISTS idx_pattern_break_tenant_window ON observability_pattern_break (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_pattern_break_computed_at ON observability_pattern_break (computed_at);

COMMENT ON TABLE observability_pattern_break IS 
'O-05: Quebra de Padrão - Permite variação semântica neutra. NUNCA induz escolha. NUNCA dispara ações.';

-- ============================================================
-- O-06: MEMÓRIA TEMPORAL
-- Observa tendências longas (nunca moraliza passado)
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_temporal_memory (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Agregação temporal (séries longas)
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(20) NOT NULL DEFAULT 'week', -- week, month, quarter, year
  
  -- Métricas de tendência
  metric_type VARCHAR(50) NOT NULL, -- Tipo de métrica observada
  metric_value NUMERIC(15, 6) NOT NULL, -- Valor da métrica no período
  previous_period_value NUMERIC(15, 6), -- Valor do período anterior (para comparação)
  
  -- Tendência
  trend_direction VARCHAR(20), -- 'increasing', 'decreasing', 'stable', 'volatile'
  trend_strength NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0-1: força da tendência
  moving_average NUMERIC(15, 6), -- Média móvel (se aplicável)
  
  -- Contexto
  domain_type VARCHAR(50), -- Domínio observado
  aggregation_level VARCHAR(50), -- Nível de agregação ('tenant', 'city', 'global')
  
  -- Metadados
  sample_size BIGINT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uniq_temporal_memory_window UNIQUE (tenant_id, window_start, window_end, window_type, metric_type, domain_type)
);

CREATE INDEX IF NOT EXISTS idx_temporal_memory_tenant_window ON observability_temporal_memory (tenant_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_temporal_memory_metric_type ON observability_temporal_memory (metric_type, window_start);
CREATE INDEX IF NOT EXISTS idx_temporal_memory_computed_at ON observability_temporal_memory (computed_at);

COMMENT ON TABLE observability_temporal_memory IS 
'O-06: Memória Temporal - Observa tendências longas. NUNCA moraliza passado. NUNCA dispara ações.';

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE observability_cognitive_density ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_normalization ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_human_concentration ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_pattern_break ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_temporal_memory ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (isolamento por tenant)
CREATE POLICY observability_cognitive_density_tenant_rls ON observability_cognitive_density
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY observability_normalization_tenant_rls ON observability_normalization
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY observability_human_concentration_tenant_rls ON observability_human_concentration
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY observability_visibility_tenant_rls ON observability_visibility
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY observability_pattern_break_tenant_rls ON observability_pattern_break
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY observability_temporal_memory_tenant_rls ON observability_temporal_memory
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMIT;

