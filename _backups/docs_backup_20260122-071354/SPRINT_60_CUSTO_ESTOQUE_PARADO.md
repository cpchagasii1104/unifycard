# SPRINT 60: CUSTO DE ESTOQUE PARADO (READ-ONLY)

## RESUMO EXECUTIVO

Implementado sistema de cálculo de custo de estoque parado:
- ✅ Cálculo de custo baseado em aging, preço e taxa de holding
- ✅ Níveis de custo (LOW, MEDIUM, HIGH)
- ✅ Explicações claras
- ✅ READ-ONLY: Nenhuma mutação de estado
- ✅ Apenas exposição analítica

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/inventory-holding-cost.types.ts`** (NOVO)
   - Tipos TypeScript para custo de estoque parado
   - `InventoryHoldingCost`, `CostLevel`, `GetHoldingCostsOptions`, `HoldingCostConfig`

2. **`backend/src/modules/marketplace/inventory-holding-cost.service.ts`** (NOVO)
   - Service para cálculo de custo
   - Métodos: `getHoldingCosts()`, `getTotalHoldingCostByActor()`, `getTotalHoldingCost()`

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `inventoryHoldingCostService`
   - Exporta tipos de holding cost

4. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Endpoint `GET /reports/inventory/holding-costs`
   - Retorna custos com resumo agregado

## MODELO DE DADOS

### InventoryHoldingCost (Não Persistido)

**Campos:**
- `productVariantId`: string
- `actorId`: string
- `quantity`: number (quantidade parada)
- `unitCost`: number (preço base, último preço válido)
- `daysInStock`: number (dias desde último movimento IN)
- `dailyHoldingRate`: number (taxa diária de holding, ex: 0.001 = 0.1%)
- `totalHoldingCost`: number (custo total acumulado)
- `costLevel`: `LOW` | `MEDIUM` | `HIGH`
- `explanation`: string (explicação legível)
- `metadata`: objeto com dados de apoio

**Regras:**
- Não é persistido (calculado on-demand)
- READ-ONLY: Nenhuma mutação

### Fórmula de Cálculo

```
totalHoldingCost = quantity * unitCost * daysInStock * dailyHoldingRate
```

**Exemplo:**
- Quantidade: 100 unidades
- Preço unitário: R$ 10,00
- Dias parado: 30 dias
- Taxa diária: 0.1% (0.001)
- Custo total: 100 * 10 * 30 * 0.001 = R$ 30,00

## FLUXO DE CÁLCULO

### 1. Buscar Aging de Estoque

```typescript
// inventorySlaService.getStockAging(tenantId, options)
// → Retorna itens com aging (dias parados)
```

### 2. Buscar Preço Atual

```typescript
// pricingService.getCurrentPrice(tenantId, productVariantId, context)
// → Retorna preço atual da variante
// → Se não houver preço, unitCost = 0
```

### 3. Calcular Custo Total

```typescript
// totalHoldingCost = quantity * unitCost * daysInStock * dailyHoldingRate
// → Calcula custo acumulado
```

### 4. Determinar Nível de Custo

```typescript
// LOW: totalHoldingCost < mediumCostThreshold (padrão: 500)
// MEDIUM: mediumCostThreshold <= totalHoldingCost < highCostThreshold (padrão: 1000)
// HIGH: totalHoldingCost >= highCostThreshold
```

### 5. Filtrar e Ordenar

```typescript
// Filtrar por minDays, minCost, minCostLevel
// Ordenar por totalHoldingCost (maior primeiro)
```

## INTEGRAÇÕES

### Inventory SLA

**Aging:**
- Usado para obter `daysInStock`
- Fonte: `inventory_movements`

### Pricing Service

**Preço atual:**
- Usado para obter `unitCost`
- Fonte: `product_prices`

### Inventory Movements

**Quantidade:**
- Usado para obter `quantity`
- Calculado a partir de movements

## GUARDRAILS

### ✅ Respeitados

1. **NÃO sugere ação**
   - Apenas expõe custo, sem recomendações

2. **NÃO cria alerta**
   - Apenas cálculo, sem alertas automáticos

3. **NÃO ajusta estoque**
   - Apenas leitura, sem mutações

4. **NÃO persiste custo**
   - Calculado on-demand, não salvo

5. **Apenas exposição analítica**
   - Fornece dados para análise humana

## EXEMPLOS DE USO

### Buscar Custos de Estoque Parado

```typescript
// Buscar custos acima de R$ 100
const costs = await inventoryHoldingCostService.getHoldingCosts(tenantId, {
  minCost: 100,
  minDays: 30,
}, {
  dailyHoldingRate: 0.001, // 0.1% ao dia
  highCostThreshold: 1000,
});

// Resultado:
// [
//   {
//     productVariantId: '...',
//     quantity: 100,
//     unitCost: 10.00,
//     daysInStock: 60,
//     totalHoldingCost: 60.00,
//     costLevel: 'MEDIUM',
//     explanation: 'Estoque parado: 100 unidades | Preço unitário: R$ 10.00 | Dias parado: 60 dias | Taxa diária: 0.10% | Custo total acumulado: R$ 60.00 | Nível de custo: MEDIUM',
//     ...
//   },
//   ...
// ]
```

### Buscar Custo Total Agregado

```typescript
// Custo total por filial
const total = await inventoryHoldingCostService.getTotalHoldingCostByActor(
  tenantId,
  actorId,
  { dailyHoldingRate: 0.001 }
);

// Resultado:
// {
//   actorId: '...',
//   totalCost: 1500.00,
//   itemCount: 25,
// }
```

### Endpoint

```http
GET /reports/inventory/holding-costs?minCost=100&minDays=30&dailyHoldingRate=0.001

Response:
{
  "holdingCosts": [
    {
      "productVariantId": "...",
      "quantity": 100,
      "unitCost": 10.00,
      "daysInStock": 60,
      "totalHoldingCost": 60.00,
      "costLevel": "MEDIUM",
      "explanation": "...",
      ...
    }
  ],
  "summary": {
    "totalCost": 1500.00,
    "itemCount": 25,
    "averageCost": 60.00
  }
}
```

## CONFIGURAÇÕES

### HoldingCostConfig

**Campos:**
- `dailyHoldingRate`: Taxa diária (padrão: 0.001 = 0.1% ao dia)
- `lowCostThreshold`: Threshold para LOW (padrão: 100)
- `mediumCostThreshold`: Threshold para MEDIUM (padrão: 500)
- `highCostThreshold`: Threshold para HIGH (padrão: 1000)

**Exemplo de taxa:**
- 0.001 = 0.1% ao dia = ~36.5% ao ano
- 0.0005 = 0.05% ao dia = ~18.25% ao ano
- 0.002 = 0.2% ao dia = ~73% ao ano

## CRITÉRIOS DE PRONTO

- ✅ Sistema mostra onde dinheiro está parado
- ✅ Humano decide o que fazer
- ✅ Nenhuma automação escondida
- ✅ Cálculo de custo baseado em aging, preço e taxa
- ✅ Níveis de custo configuráveis
- ✅ Explicações claras
- ✅ READ-ONLY: Nenhuma mutação

## PRÓXIMOS PASSOS

- [ ] Adicionar `actor_id` em `inventory_movements` (se necessário)
- [ ] Integrar com histórico de preços (quando disponível)
- [ ] Adicionar cálculo de custo por período (mensal, anual)
- [ ] Testes de integração
- [ ] UI mínima para visualização de custos

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Analítico:** Fornece dados para análise, não executa ações
3. **Configurável:** Taxa de holding e thresholds podem ser ajustados
4. **Transparente:** Explicação clara de como o custo foi calculado
5. **Base para decisão:** Fornece dados para decisão humana sobre estoque parado





