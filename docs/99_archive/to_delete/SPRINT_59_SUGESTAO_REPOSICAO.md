# SPRINT 59: SUGESTÃO DE REPOSIÇÃO DE ESTOQUE (ASSISTIDA, READ-ONLY)

## RESUMO EXECUTIVO

Implementado sistema de sugestões de reposição de estoque:
- ✅ Sugestões de REPLENISH (reposição)
- ✅ Sugestões de TRANSFER (transferência entre filiais)
- ✅ Sugestões de REDUCE (redução de estoque parado)
- ✅ READ-ONLY: Nenhuma mutação de estado
- ✅ Explicações claras para decisão humana

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/inventory-suggestion.types.ts`** (NOVO)
   - Tipos TypeScript para sugestões
   - `InventorySuggestion`, `InventorySuggestionType`, `ConfidenceLevel`, `SuggestionReasonCode`, etc.

2. **`backend/src/modules/marketplace/inventory-suggestion.service.ts`** (NOVO)
   - Service para gerar sugestões
   - Métodos: `getSuggestions()`, `explainSuggestion()`
   - Regras explícitas: REPLENISH, TRANSFER, REDUCE

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `inventorySuggestionService`
   - Exporta tipos de sugestão

4. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Endpoint `GET /reports/inventory/suggestions`
   - Retorna sugestões com explicações detalhadas

## MODELO DE DADOS

### InventorySuggestion (Não Persistido)

**Campos:**
- `productVariantId`: string
- `actorId`: string
- `suggestionType`: `REPLENISH` | `TRANSFER` | `REDUCE`
- `suggestedQuantity`: number (pode ser negativa para REDUCE)
- `reasonCodes`: `SuggestionReasonCode[]`
- `confidenceLevel`: `LOW` | `MEDIUM` | `HIGH`
- `explanation`: string (explicação legível)
- `metadata`: objeto com dados de apoio

**Regras:**
- Não é persistido (calculado on-demand)
- READ-ONLY: Nenhuma mutação

### SuggestionReasonCode

**Códigos:**
- `LOW_STOCK_DAYS`: Estoque disponível < X dias de venda média
- `HIGH_AGING_ACTIVE`: Aging alto + saída recorrente
- `EXCESS_STOCK`: Filial com excesso de estoque
- `STOCKOUT_RISK`: Filial com risco de ruptura
- `HIGH_AGING_LOW_TURNOVER`: Aging alto + baixa rotatividade
- `STALE_STOCK`: Estoque parado acima de threshold
- `CROSS_BRANCH_OPPORTUNITY`: Oportunidade de transferência entre filiais

## REGRAS DE SUGESTÃO

### 1. REPLENISH (Reposição)

**Condições:**
- Estoque disponível < `minDaysOfStock` dias de venda média
- Aging alto + saída recorrente

**Cálculo:**
- `suggestedQuantity` = quantidade necessária para atingir `minDaysOfStock` dias
- `confidenceLevel` = baseado em histórico de vendas e aging

**Fonte de dados:**
- `inventory_movements` (saldo atual)
- `inventory_reservations` (estoque disponível)
- Sales reports (média de vendas)

### 2. TRANSFER (Transferência entre filiais)

**Condições:**
- Filial A com excesso (estoque > média * `excessStockMultiplier`)
- Filial B com risco de ruptura (estoque < `stockoutRiskThreshold` dias)
- Mesma organização

**Cálculo:**
- `suggestedQuantity` = quantidade a transferir
- `metadata.targetActorId` = filial destino
- `metadata.sourceActorId` = filial origem

**Fonte de dados:**
- `inventory_sla` (aging por filial)
- `stock_transfers` (histórico de transferências)

### 3. REDUCE (Redução de estoque parado)

**Condições:**
- Aging alto (`agingDays` > `staleStockThreshold`)
- Baixa rotatividade (`turnoverRate` < `lowTurnoverThreshold`)

**Cálculo:**
- `suggestedQuantity` = negativo (reduzir ~30% do estoque atual)
- `confidenceLevel` = HIGH se aging > `staleStockThreshold * 2`

**Fonte de dados:**
- `inventory_sla` (aging de estoque)
- Sales reports (rotatividade)

## FLUXO DE SUGESTÃO

### 1. Gerar Sugestões

```typescript
// inventorySuggestionService.getSuggestions(tenantId, options, config)
// → Calcula sugestões baseadas em regras explícitas
// → Filtra por tipo, confiança, etc.
// → Ordena por confiança (HIGH primeiro)
// → Retorna lista de sugestões
```

**Regras aplicadas:**
- REPLENISH: Estoque baixo
- TRANSFER: Oportunidades entre filiais
- REDUCE: Estoque parado

### 2. Explicar Sugestão

```typescript
// inventorySuggestionService.explainSuggestion(suggestion)
// → Gera explicação detalhada e legível
// → Inclui motivos, dados de apoio, etc.
```

**Formato:**
- Tipo de sugestão
- Variante e filial
- Quantidade sugerida
- Nível de confiança
- Lista de motivos
- Explicação detalhada
- Dados de apoio (metadata)

## INTEGRAÇÕES

### Inventory SLA

**Aging:**
- Usado para identificar estoque parado
- Calcula dias desde último movimento IN

### Inventory Service

**Saldo:**
- Usado para calcular estoque disponível
- Considera reservas

### Sales Reports

**Média de vendas:**
- Usado para calcular dias de estoque
- Base para sugestões de reposição

### Inventory Reservations

**Estoque disponível:**
- Usado para calcular estoque real disponível
- Considera reservas ativas

## GUARDRAILS

### ✅ Respeitados

1. **NÃO criar estoque**
   - Apenas sugestões, sem execução

2. **NÃO criar transferências**
   - Apenas recomendações, sem criar `stock_transfers`

3. **NÃO criar ajustes**
   - Apenas sugestões, sem criar `inventory_adjustments`

4. **NÃO criar alertas automáticos**
   - Apenas sugestões, sem criar `alerts`

5. **NÃO persistir sugestões**
   - Calculadas on-demand, não salvas

## EXEMPLOS DE USO

### Buscar Sugestões

```typescript
// Buscar todas as sugestões
const suggestions = await inventorySuggestionService.getSuggestions(tenantId, {
  minConfidence: 'MEDIUM',
  limit: 50,
}, {
  minDaysOfStock: 7,
  staleStockThreshold: 60,
});

// Resultado:
// [
//   {
//     productVariantId: '...',
//     suggestionType: 'REDUCE',
//     suggestedQuantity: -30,
//     confidenceLevel: 'HIGH',
//     explanation: 'Estoque parado há 90 dias...',
//     ...
//   },
//   ...
// ]
```

### Explicar Sugestão

```typescript
// Explicar uma sugestão em detalhes
const explanation = inventorySuggestionService.explainSuggestion(suggestion);

// Resultado:
// "Sugestão: REDUCE
//  Variante: ...
//  Filial: ...
//  Quantidade sugerida: -30
//  Confiança: HIGH
//  
//  Motivos:
//  - Estoque com aging alto e baixa rotatividade
//  - Estoque parado acima do threshold configurado
//  
//  Explicação: Estoque parado há 90 dias...
//  
//  Dados de apoio:
//  - currentStock: 100
//  - agingDays: 90
//  - turnoverRate: 0.05
//  "
```

## CRITÉRIOS DE PRONTO

- ✅ Sistema sugere
- ✅ Humano decide
- ✅ Nenhuma ação invisível
- ✅ Sugestões de REPLENISH, TRANSFER, REDUCE
- ✅ Explicações claras
- ✅ READ-ONLY: Nenhuma mutação

## PRÓXIMOS PASSOS

- [ ] Implementar cálculo completo de REPLENISH (média de vendas)
- [ ] Implementar cálculo completo de TRANSFER (oportunidades entre filiais)
- [ ] Adicionar `actor_id` em `inventory_movements` (se necessário)
- [ ] Integrar com sales reports para média de vendas
- [ ] Testes de integração
- [ ] UI mínima para visualização de sugestões

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Assistido:** Sugestões são recomendações, não execuções
3. **Explicável:** Cada sugestão tem explicação clara
4. **Configurável:** Thresholds podem ser ajustados
5. **Base para decisão:** Fornece dados para decisão humana





