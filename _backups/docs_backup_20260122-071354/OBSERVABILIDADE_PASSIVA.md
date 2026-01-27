# Observabilidade Passiva — UnifiCard

**Data**: 2024-12-19  
**Objetivo**: Estrutura técnica para observabilidade passiva conforme contratos O-01 a O-06

---

## DEFINIÇÃO

Observabilidade passiva serve para:
- ✅ Perceber padrões agregados
- ✅ Expor tendências temporais
- ✅ Manter consciência sistêmica
- ✅ Calcular métricas agregadas
- ✅ Armazenar séries temporais

Observabilidade passiva **NÃO serve** para:
- ❌ Acionar decisões
- ❌ Corrigir comportamentos
- ❌ Otimizar resultados
- ❌ Justificar controle
- ❌ Gerar alertas
- ❌ Alterar UX
- ❌ Identificar indivíduos

---

## CONTRATOS O-01 a O-06

### O-01: DENSIDADE COGNITIVA

**O que mede:**
- Intensidade de decisões tomadas no sistema (agregado)
- Carga cognitiva coletiva (não individual)
- Média de decisões por ator

**O que NÃO mede:**
- Eficiência de decisões
- Qualidade de decisões
- Identidade de quem decidiu

**O que NUNCA pode ser feito:**
- Disparar ações baseadas em densidade
- Bloquear decisões quando densidade é alta
- Identificar indivíduos específicos
- Gerar alertas automáticos

**Tabela**: `observability_cognitive_density`

**Métricas principais:**
- `cognitive_density_index` (0-1): Intensidade de carga decisória
- `total_decisions_count`: Total de decisões no período
- `unique_actors_count`: Atores únicos (sem identificar quem)
- `average_decisions_per_actor`: Média de decisões por ator

---

### O-02: NORMALIZAÇÃO

**O que mede:**
- Variação de comportamentos no sistema
- Entropia comportamental (diversidade de ações)
- Perda de variação comportamental

**O que NÃO mede:**
- Eficiência de processos
- Otimização de fluxos
- Performance individual

**O que NUNCA pode ser feito:**
- Forçar normalização quando variação é alta
- Penalizar variação comportamental
- Disparar ações baseadas em normalização

**Tabela**: `observability_normalization`

**Métricas principais:**
- `variation_index` (0-1): 0 = totalmente normalizado, 1 = máxima variação
- `entropy_score`: Entropia comportamental (Shannon)
- `unique_behavioral_patterns_count`: Padrões comportamentais únicos

---

### O-03: CONCENTRAÇÃO HUMANA

**O que mede:**
- Distribuição de interações no sistema
- Centralidade emergente (sem identificar quem)
- Coeficiente de Gini de interações

**O que NÃO mede:**
- Identidade de pessoas específicas
- Performance individual
- Reputação de atores

**O que NUNCA pode ser feito:**
- Nomear pessoas específicas
- Criar ranking de atores
- Disparar ações baseadas em concentração
- Penalizar centralidade

**Tabela**: `observability_human_concentration`

**Métricas principais:**
- `gini_coefficient` (0-1): 0 = igualdade, 1 = concentração máxima
- `concentration_index` (0-1): Intensidade de concentração
- `top_percentile_share`: Participação do top 10% (sem identificar quem)

---

### O-04: VISIBILIDADE

**O que mede:**
- Distribuição de visualizações/atenção
- Gini da distribuição de atenção
- Participação da cauda longa

**O que NÃO mede:**
- Qualidade de conteúdo
- Relevância de itens
- Performance de posts

**O que NUNCA pode ser feito:**
- Rebalancear feed automaticamente
- Alterar ordem de exibição
- Promover/demover conteúdo
- Disparar ações baseadas em visibilidade

**Tabela**: `observability_visibility`

**Métricas principais:**
- `attention_gini_coefficient` (0-1): Gini da distribuição de atenção
- `visibility_index` (0-1): 0 = atenção concentrada, 1 = atenção distribuída
- `long_tail_share`: Participação da cauda longa (sem identificar itens)

---

### O-05: QUEBRA DE PADRÃO

**O que mede:**
- Variação semântica de ações
- Quebras de padrão comportamental
- Diversidade de escolhas

**O que NÃO mede:**
- Correção de padrões
- Eficiência de escolhas
- Qualidade de decisões

**O que NUNCA pode ser feito:**
- Induzir escolhas específicas
- Penalizar quebras de padrão
- Forçar normalização
- Disparar ações baseadas em quebra de padrão

**Tabela**: `observability_pattern_break`

**Métricas principais:**
- `pattern_break_index` (0-1): Intensidade de quebra de padrão
- `semantic_variation_score`: Variação semântica (semântica neutra)
- `pattern_break_actions_count`: Ações que quebram padrão

---

### O-06: MEMÓRIA TEMPORAL

**O que mede:**
- Tendências temporais de métricas
- Direção e força de tendências
- Médias móveis

**O que NÃO mede:**
- Correção de comportamento passado
- Justiça de decisões históricas
- Moralidade de ações anteriores

**O que NUNCA pode ser feito:**
- Moralizar passado
- Penalizar tendências históricas
- Disparar ações baseadas em tendências
- Corrigir comportamento baseado em memória

**Tabela**: `observability_temporal_memory`

**Métricas principais:**
- `trend_direction`: 'increasing', 'decreasing', 'stable', 'volatile'
- `trend_strength` (0-1): Força da tendência
- `moving_average`: Média móvel (se aplicável)

---

## ESTRUTURA TÉCNICA

### Tabelas Criadas

1. `observability_cognitive_density` (O-01)
2. `observability_normalization` (O-02)
3. `observability_human_concentration` (O-03)
4. `observability_visibility` (O-04)
5. `observability_pattern_break` (O-05)
6. `observability_temporal_memory` (O-06)

### Componentes

1. **Types** (`observability-passive.types.ts`)
   - Interfaces TypeScript para cada sinal
   - Comentários explicando o que cada sinal mede e não mede

2. **Repository** (`observability-passive.repository.ts`)
   - Repositories para cada sinal
   - Métodos `upsertSignal()` para armazenar métricas

3. **Projector** (`observability-passive.projector.ts`)
   - Projector passivo que calcula métricas agregadas
   - Métodos `project*()` para cada sinal
   - Função auxiliar `calculateGini()`

### Migration

- Arquivo: `migrations/148_observability_passive.sql`
- Cria todas as tabelas com RLS
- Índices para performance
- Constraints UNIQUE para evitar duplicatas

---

## REGRAS ABSOLUTAS

### O que é permitido:
- ✅ Calcular métricas agregadas
- ✅ Armazenar séries temporais
- ✅ Expor dados via read models
- ✅ Calcular índices e coeficientes

### O que é proibido:
- ❌ Disparar ações baseadas em sinais
- ❌ Gerar alertas automáticos
- ❌ Alterar estado de domínio
- ❌ Identificar indivíduos específicos
- ❌ Criar ranking ou score
- ❌ Rebalancear feed
- ❌ Moralizar passado
- ❌ Induzir escolhas

---

## USO FUTURO

Os sinais de observabilidade podem ser:
- Consultados via read models
- Visualizados em dashboards
- Analisados por humanos
- Usados para entender padrões

Os sinais de observabilidade **NÃO podem** ser:
- Usados como input para decisões automáticas
- Usados para gerar alertas
- Usados para alterar comportamento do sistema
- Usados para identificar indivíduos

---

## EXEMPLO DE USO

```typescript
// ✅ PERMITIDO: Calcular e armazenar métrica
const signal = await observabilityPassiveProjector.projectCognitiveDensity(
  tenantId,
  windowStart,
  windowEnd,
  'hour',
  {
    totalDecisionsCount: 150,
    uniqueActorsCount: 30,
    domainType: 'booking',
    sampleSize: 150,
  }
);

// ✅ PERMITIDO: Consultar métrica
const signals = await cognitiveDensityRepository.findSignals(tenantId, filters);

// ❌ PROIBIDO: Usar sinal para decisão
if (signal.cognitiveDensityIndex > 0.8) {
  // NUNCA fazer isso
  await blockDecisions();
}
```

---

**Status**: ✅ Estrutura técnica implementada

**Próximos passos**: Implementar jobs que calculam métricas periodicamente (fora do escopo atual)

