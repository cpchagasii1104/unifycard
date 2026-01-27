# SPRINT 63: ESTRATÉGIA DE PREÇO ASSISTIDA (READ-ONLY)

## RESUMO EXECUTIVO

Implementado sistema de estratégia de preço assistida:
- ✅ Análise de preço atual, margem e holding cost
- ✅ Faixa de preço sugerida (nunca valor único)
- ✅ Impacto na margem e holding cost
- ✅ Sensibilidade da demanda
- ✅ Cenários what-if
- ✅ READ-ONLY: Nenhuma alteração de preço
- ✅ Estratégia = informação, não ação

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/pricing-strategy.types.ts`** (NOVO)
   - Tipos TypeScript para estratégia de preço
   - `PricingStrategyInsight`, `GetPricingStrategyOptions`

2. **`backend/src/modules/marketplace/pricing-strategy.service.ts`** (NOVO)
   - Service para análise de estratégia
   - Método: `getPriceStrategy()`

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `pricingStrategyService`
   - Exporta tipos de estratégia

4. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Endpoint `GET /reports/pricing/strategy`

## MODELO DE DADOS

### PricingStrategyInsight (Não Persistido)

**Campos:**
- `productVariantId`: string
- `actorId`: string (opcional)
- `channel`: `PDV` | `MARKETPLACE` (opcional)
- `currentPrice`: number
- `suggestedPriceRange`: objeto com `min`, `max`, `optimal`
- `marginImpact`: objeto com margens atual, min, max, optimal
- `holdingCostImpact`: objeto com custos atual, min, max
- `demandSensitivity`: objeto com elasticidade e impactos
- `scenarios`: array de `DecisionSimulationResult`
- `explanation`: string
- `confidenceLevel`: `LOW` | `MEDIUM` | `HIGH`
- `metadata`: objeto com dados de apoio

**Regras:**
- Não é persistido (calculado on-demand)
- READ-ONLY: Nenhuma mutação
- Sempre sugere faixa, nunca valor único

## FLUXO DE ANÁLISE

### 1. Buscar Dados Atuais

```typescript
// getPriceStrategy()
1. Buscar preço atual (pricingService)
2. Buscar margem atual (realMarginService)
3. Buscar holding cost atual (inventoryHoldingCostService)
4. Buscar dados históricos (vendas, estoque, aging)
```

### 2. Calcular Faixa de Preço

```typescript
// calculatePriceRange()
- Min: -20% do preço atual (aumenta demanda)
- Max: +20% do preço atual (reduz demanda)
- Optimal: +10% do preço atual (maximiza receita)
- Limites: não menos que 50%, não mais que 200%
```

### 3. Gerar Simulações

```typescript
// generateScenarios()
- Simula diferentes preços na faixa
- Usa decisionSimulationService.simulatePriceChange()
- Gera cenários what-if para análise
```

### 4. Calcular Impactos

```typescript
// calculateMarginImpact()
- Margem com preço mínimo
- Margem com preço máximo
- Margem com preço ótimo

// calculateHoldingCostImpact()
- Holding cost com preço mínimo
- Holding cost com preço máximo
```

### 5. Calcular Sensibilidade

```typescript
// calculateDemandSensitivity()
- Elasticidade: -1.5 (padrão)
- Impacto de -10%, -5%, +5%, +10% de preço
- Variação de demanda = Variação de preço * Elasticidade
```

### 6. Determinar Confiança

```typescript
// determineConfidenceLevel()
- LOW: poucos dados (< 7 dias) ou sem vendas
- MEDIUM: dados moderados (7-30 dias)
- HIGH: dados suficientes (> 30 dias)
```

## INTEGRAÇÕES

### Pricing Service

**Preço atual:**
- Usado como base para análise
- Fonte: `product_prices`

### Real Margin Service

**Margem atual:**
- Usado para comparar com margens estimadas
- Fonte: `orders`, `payment_splits`

### Decision Simulation Service

**Simulações:**
- Usado para gerar cenários what-if
- Fonte: simulações de mudança de preço

### Inventory Holding Cost Service

**Custo de estoque:**
- Usado para comparar custos
- Fonte: `inventory_sla`, `pricing`

### Inventory SLA Service

**Aging:**
- Usado para calcular holding cost
- Fonte: `inventory_movements`

## GUARDRAILS

### ✅ Respeitados

1. **READ-ONLY**
   - Apenas leitura, sem mutações

2. **Nenhuma alteração de preço**
   - Não aplica preços automaticamente

3. **Nenhuma automação**
   - Apenas análise, sem ações

4. **Nenhuma persistência**
   - Resultados não são salvos

5. **Estratégia = informação, não ação**
   - Usuário decide o que fazer

6. **Sempre faixa, nunca valor único**
   - Sugere min/max/optimal, não valor fixo

## EXEMPLOS DE USO

### Buscar Estratégia de Preço

```http
GET /reports/pricing/strategy?productVariantId=...&actorId=...&channel=MARKETPLACE

Response:
{
  "productVariantId": "...",
  "currentPrice": 10.00,
  "suggestedPriceRange": {
    "min": 8.00,
    "max": 12.00,
    "optimal": 11.00
  },
  "marginImpact": {
    "currentMargin": 1.50,
    "minMargin": 1.20,
    "maxMargin": 1.80,
    "optimalMargin": 1.65
  },
  "holdingCostImpact": {
    "currentHoldingCost": 0.50,
    "estimatedHoldingCostAtMin": 0.40,
    "estimatedHoldingCostAtMax": 0.60
  },
  "demandSensitivity": {
    "elasticity": -1.5,
    "priceChangeImpact": {
      "minus10Percent": 15.0,
      "minus5Percent": 7.5,
      "plus5Percent": -7.5,
      "plus10Percent": -15.0
    }
  },
  "scenarios": [...],
  "explanation": "Preço atual: R$ 10.00 | Faixa sugerida: R$ 8.00 - R$ 12.00 | ...",
  "confidenceLevel": "HIGH"
}
```

## FÓRMULAS

### Faixa de Preço

```
min = currentPrice * 0.8 (mínimo: 50% do atual)
max = currentPrice * 1.2 (máximo: 200% do atual)
optimal = currentPrice * 1.1 (ótimo estimado)
```

### Sensibilidade da Demanda

```
Variação de Demanda = Variação de Preço * Elasticidade

Exemplos (elasticidade -1.5):
- -10% de preço → +15% de demanda
- -5% de preço → +7.5% de demanda
- +5% de preço → -7.5% de demanda
- +10% de preço → -15% de demanda
```

### Preço Ótimo

```
Receita = Preço * Demanda
Demanda = DemandaAtual * (1 + (VariaçãoPreço * Elasticidade))

Para elasticidade -1.5:
Preço Ótimo ≈ PreçoAtual * 1.1
```

## CRITÉRIOS DE PRONTO

- ✅ Usuário entende impacto de mudar preço
- ✅ Sistema nunca aplica sozinho
- ✅ Faixa de preço sugerida (nunca valor único)
- ✅ Impacto na margem e holding cost
- ✅ Sensibilidade da demanda
- ✅ Cenários what-if
- ✅ READ-ONLY: Nenhuma mutação

## PRÓXIMOS PASSOS

- [ ] Testar estratégias com dados reais
- [ ] Ajustar elasticidade baseada em histórico
- [ ] Adicionar mais métricas se necessário
- [ ] Testes de integração
- [ ] UI mínima para visualização de estratégias

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Faixa, não valor único:** Sempre sugere min/max/optimal
3. **Informação, não ação:** Usuário decide o que fazer
4. **Baseado em dados reais:** Usa histórico, margem e holding cost
5. **Explicável:** Cada estratégia tem explicação clara
6. **Sem risco:** Sistema não aplica preços automaticamente





