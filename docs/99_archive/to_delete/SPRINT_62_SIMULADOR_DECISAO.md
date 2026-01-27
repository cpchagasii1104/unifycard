# SPRINT 62: SIMULADOR DE DECISÃO (WHAT-IF, READ-ONLY)

## RESUMO EXECUTIVO

Implementado simulador de decisão (what-if):
- ✅ Simulação de mudança de preço
- ✅ Simulação de desconto
- ✅ Simulação de transferência
- ✅ Simulação de redução de estoque
- ✅ READ-ONLY: Nenhuma mutação de estado
- ✅ Baseado em dados históricos e médias móveis simples

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/decision-simulation.types.ts`** (NOVO)
   - Tipos TypeScript para simulação
   - `DecisionSimulationResult`, `ScenarioType`, inputs de simulação

2. **`backend/src/modules/marketplace/decision-simulation.service.ts`** (NOVO)
   - Service para simulação
   - Métodos: `simulatePriceChange()`, `simulateDiscount()`, `simulateTransfer()`, `simulateStockReduction()`, `simulate()`

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `decisionSimulationService`
   - Exporta tipos de simulação

4. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Endpoint `POST /reports/simulations`

## MODELO DE DADOS

### DecisionSimulationResult (Não Persistido)

**Campos:**
- `scenarioType`: `PRICE_CHANGE` | `DISCOUNT` | `TRANSFER` | `REDUCE_STOCK`
- `inputParameters`: Record<string, any>
- `estimatedRevenue`: number
- `estimatedMargin`: number
- `estimatedHoldingCost`: number
- `estimatedStockAfter`: number
- `deltaVsCurrent`: objeto com diferenças
- `explanation`: string (explicação legível)
- `confidenceLevel`: `LOW` | `MEDIUM` | `HIGH`
- `metadata`: objeto com dados de apoio

**Regras:**
- Não é persistido (calculado on-demand)
- READ-ONLY: Nenhuma mutação

## CENÁRIOS DE SIMULAÇÃO

### 1. PRICE_CHANGE (Mudança de Preço)

**Input:**
- `productVariantId`: string
- `actorId`: string (opcional)
- `newPrice`: number
- `periodDays`: number (padrão: 30)

**Cálculo:**
- Busca preço atual
- Busca média de vendas diárias (histórico)
- Estima impacto usando elasticidade de preço (-1.5)
- Calcula receita e margem estimadas
- Compara com receita e margem atuais

**Fórmula:**
```
priceChangePercent = ((newPrice - currentPrice) / currentPrice) * 100
demandChangePercent = priceChangePercent * elasticity (-1.5)
estimatedDailySales = averageDailySales * (1 + demandChangePercent / 100)
estimatedRevenue = estimatedDailySales * newPrice * periodDays
```

### 2. DISCOUNT (Desconto)

**Input:**
- `productVariantId`: string
- `actorId`: string (opcional)
- `discountPercentage`: number (opcional)
- `discountAmount`: number (opcional)
- `periodDays`: number (padrão: 30)

**Cálculo:**
- Calcula novo preço com desconto
- Usa mesma lógica de `PRICE_CHANGE`

### 3. TRANSFER (Transferência)

**Input:**
- `productVariantId`: string
- `fromActorId`: string
- `toActorId`: string
- `quantity`: number

**Cálculo:**
- Busca estoque atual nas filiais
- Valida estoque suficiente
- Estima estoque após transferência
- Estima holding cost após transferência
- Compara com holding cost atual

### 4. REDUCE_STOCK (Redução de Estoque)

**Input:**
- `productVariantId`: string
- `actorId`: string
- `reductionQuantity`: number
- `reductionType`: `LOSS` | `DAMAGE` | `SURPLUS`

**Cálculo:**
- Busca estoque atual
- Valida estoque suficiente
- Estima estoque após redução
- Estima holding cost após redução
- Calcula economia estimada

## FLUXO DE SIMULAÇÃO

### 1. Receber Input

```typescript
// POST /reports/simulations
{
  scenarioType: 'PRICE_CHANGE',
  parameters: {
    productVariantId: '...',
    newPrice: 15.00,
    periodDays: 30,
  }
}
```

### 2. Buscar Dados Históricos

```typescript
// getAverageDailySales() - média de vendas diárias
// getHistoricalMargin() - margem histórica média
// getCurrentStock() - estoque atual
// estimateHoldingCost() - custo de estoque parado
```

### 3. Calcular Estimativas

```typescript
// Usa dados históricos e fórmulas simples
// NÃO usa IA, NÃO prevê demanda complexa
// Apenas médias móveis e elasticidade básica
```

### 4. Comparar com Atual

```typescript
// deltaVsCurrent = estimado - atual
// Explica diferenças claramente
```

### 5. Determinar Confiança

```typescript
// LOW: poucos dados históricos (< 7 dias)
// MEDIUM: dados moderados (7-30 dias)
// HIGH: dados suficientes (> 30 dias)
```

## INTEGRAÇÕES

### Pricing Service

**Preço atual:**
- Usado para comparar com novo preço
- Fonte: `product_prices`

### Real Margin Service

**Margem histórica:**
- Usado para estimar margem futura
- Fonte: `orders`, `payment_splits`

### Inventory Service

**Estoque atual:**
- Usado para validar e comparar
- Fonte: `inventory_movements`

### Inventory SLA Service

**Aging:**
- Usado para estimar holding cost
- Fonte: `inventory_movements`

### Inventory Holding Cost Service

**Custo de estoque:**
- Usado para comparar custos
- Fonte: `inventory_sla`, `pricing`

## GUARDRAILS

### ✅ Respeitados

1. **READ-ONLY**
   - Apenas leitura, sem mutações

2. **Nenhuma escrita em banco**
   - Resultados não são salvos

3. **Nenhuma automação**
   - Apenas cálculo, sem ações

4. **Nenhuma sugestão automática**
   - Apenas simulação, sem recomendações

5. **Resultado sempre explicável**
   - Explicação clara de como foi calculado

## EXEMPLOS DE USO

### Simular Mudança de Preço

```http
POST /reports/simulations
{
  "scenarioType": "PRICE_CHANGE",
  "parameters": {
    "productVariantId": "...",
    "newPrice": 15.00,
    "periodDays": 30
  }
}

Response:
{
  "scenarioType": "PRICE_CHANGE",
  "estimatedRevenue": 15000.00,
  "estimatedMargin": 2250.00,
  "deltaVsCurrent": {
    "revenue": 1500.00,
    "margin": 225.00
  },
  "explanation": "Cenário: Mudança de preço de R$ 10.00 para R$ 15.00 (+50.0%) | ...",
  "confidenceLevel": "HIGH"
}
```

### Simular Desconto

```http
POST /reports/simulations
{
  "scenarioType": "DISCOUNT",
  "parameters": {
    "productVariantId": "...",
    "discountPercentage": 10,
    "periodDays": 30
  }
}
```

### Simular Transferência

```http
POST /reports/simulations
{
  "scenarioType": "TRANSFER",
  "parameters": {
    "productVariantId": "...",
    "fromActorId": "...",
    "toActorId": "...",
    "quantity": 50
  }
}
```

### Simular Redução de Estoque

```http
POST /reports/simulations
{
  "scenarioType": "REDUCE_STOCK",
  "parameters": {
    "productVariantId": "...",
    "actorId": "...",
    "reductionQuantity": 20,
    "reductionType": "DAMAGE"
  }
}
```

## CRITÉRIOS DE PRONTO

- ✅ Usuário consegue testar decisão sem risco
- ✅ Sistema não executa nada
- ✅ Sistema não empurra decisão
- ✅ Simulações de preço, desconto, transferência e redução
- ✅ Baseado em dados históricos
- ✅ Explicações claras
- ✅ READ-ONLY: Nenhuma mutação

## PRÓXIMOS PASSOS

- [ ] Testar simulações com dados reais
- [ ] Ajustar elasticidade de preço (configurável)
- [ ] Adicionar mais cenários se necessário
- [ ] Testes de integração
- [ ] UI mínima para simulações

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Histórico:** Usa dados históricos reais, não previsões complexas
3. **Simples:** Médias móveis e elasticidade básica, sem IA
4. **Explicável:** Cada simulação tem explicação clara
5. **Sem risco:** Usuário pode testar sem executar nada





