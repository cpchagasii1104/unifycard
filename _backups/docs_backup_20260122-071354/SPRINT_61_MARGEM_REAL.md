# SPRINT 61: MARGEM REAL POR PRODUTO / CANAL / FILIAL (READ-ONLY)

## RESUMO EXECUTIVO

Implementado sistema de cálculo de margem real:
- ✅ Margem por variante de produto
- ✅ Margem por filial (actor)
- ✅ Margem por canal (PDV | MARKETPLACE)
- ✅ Consolidação de receita, fees, payouts e holding cost
- ✅ READ-ONLY: Nenhuma mutação de estado
- ✅ Apenas consolidação de dados existentes

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/real-margin.types.ts`** (NOVO)
   - Tipos TypeScript para margem real
   - `RealMarginReport`, `MarginChannel`, `GetMarginOptions`, `MarginConfig`

2. **`backend/src/modules/marketplace/real-margin.service.ts`** (NOVO)
   - Service para cálculo de margem
   - Métodos: `getMarginByVariant()`, `getMarginByActor()`, `getMarginByChannel()`

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `realMarginService`
   - Exporta tipos de margem

4. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Endpoints: `GET /reports/margin/variants`, `/margin/actors`, `/margin/channels`

## MODELO DE DADOS

### RealMarginReport (Não Persistido)

**Campos:**
- `productVariantId`: string (opcional, pode ser agregado)
- `actorId`: string (opcional, pode ser agregado)
- `channel`: `PDV` | `MARKETPLACE` (opcional, pode ser agregado)
- `grossRevenue`: number (receita bruta)
- `discounts`: number (total de descontos)
- `platformFees`: number (fees da plataforma)
- `payouts`: number (payouts para vendedores)
- `holdingCost`: number (custo de estoque parado)
- `netMargin`: number (margem líquida)
- `marginPercentage`: number (percentual de margem)
- `explanation`: string (explicação legível)
- `metadata`: objeto com dados de apoio

**Regras:**
- Não é persistido (calculado on-demand)
- READ-ONLY: Nenhuma mutação

### Fórmula de Cálculo

```
grossRevenue = sum(priceSnapshot.finalPrice * quantity)
discounts = sum(priceSnapshot.discountAmount)
platformFees = sum(splits onde role = PLATFORM)
payouts = sum(splits onde role = SELLER)
holdingCost = InventoryHoldingCostService (opcional)
netMargin = grossRevenue - platformFees - holdingCost
marginPercentage = (netMargin / grossRevenue) * 100
```

## FLUXO DE CÁLCULO

### 1. Receita Bruta

```typescript
// Consolida order_items com priceSnapshot
// grossRevenue = sum(priceSnapshot.finalPrice * quantity)
// discounts = sum(priceSnapshot.discountAmount)
```

**Fonte:**
- `order_items` (metadata.priceSnapshot)
- `orders` (status, buyer_actor_id, metadata.source)

### 2. Fees e Payouts

```typescript
// Consolida payment_splits
// platformFees = sum(splits onde role = PLATFORM)
// payouts = sum(splits onde role = SELLER)
```

**Fonte:**
- `payment_splits` (role, amount)
- `payment_intents` (order_id)
- `orders` (para vincular a variantes)

### 3. Holding Cost

```typescript
// Opcional: calcula custo de estoque parado
// holdingCost = InventoryHoldingCostService.getHoldingCosts()
```

**Fonte:**
- `inventory_holding_cost` (Sprint 60)

### 4. Margem Líquida

```typescript
// netMargin = grossRevenue - platformFees - holdingCost
// marginPercentage = (netMargin / grossRevenue) * 100
```

## INTEGRAÇÕES

### Orders e Order Items

**Receita:**
- Lê `order_items.metadata.priceSnapshot`
- Consolida por variante, actor e canal

### Payment Splits

**Fees e Payouts:**
- Lê `payment_splits` com `role = PLATFORM` ou `SELLER`
- Vincula a orders e order_items

### Inventory Holding Cost

**Custo de estoque:**
- Usa `InventoryHoldingCostService` (opcional)
- Calcula custo de estoque parado

## GUARDRAILS

### ✅ Respeitados

1. **READ-ONLY**
   - Apenas leitura, sem mutações

2. **Nenhuma automação**
   - Apenas cálculo, sem ações automáticas

3. **Nenhuma sugestão**
   - Apenas exposição, sem recomendações

4. **Nenhuma persistência**
   - Calculado on-demand, não salvo

5. **Apenas consolidação de dados existentes**
   - Não recalcula split
   - Não recalcula preço
   - Não infere custo de produto

## EXEMPLOS DE USO

### Margem por Variante

```typescript
// Buscar margem por variante
const margins = await realMarginService.getMarginByVariant(tenantId, {
  productVariantId: '...',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
}, {
  includeHoldingCost: true,
});

// Resultado:
// [
//   {
//     productVariantId: '...',
//     actorId: '...',
//     channel: 'MARKETPLACE',
//     grossRevenue: 10000.00,
//     discounts: 500.00,
//     platformFees: 500.00,
//     payouts: 8000.00,
//     holdingCost: 100.00,
//     netMargin: 1400.00,
//     marginPercentage: 14.00,
//     explanation: 'Receita bruta: R$ 10000.00 | Descontos: R$ 500.00 | Fees plataforma: R$ 500.00 | Payouts: R$ 8000.00 | Custo estoque parado: R$ 100.00 | Margem líquida: R$ 1400.00 (14.00%)',
//     ...
//   },
//   ...
// ]
```

### Margem por Filial

```typescript
// Buscar margem agregada por filial
const margins = await realMarginService.getMarginByActor(tenantId, {
  actorId: '...',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
});

// Resultado: Margem agregada por actor
```

### Margem por Canal

```typescript
// Buscar margem agregada por canal
const margins = await realMarginService.getMarginByChannel(tenantId, {
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
});

// Resultado:
// [
//   {
//     channel: 'MARKETPLACE',
//     grossRevenue: 50000.00,
//     netMargin: 7000.00,
//     marginPercentage: 14.00,
//     ...
//   },
//   {
//     channel: 'PDV',
//     grossRevenue: 30000.00,
//     netMargin: 5000.00,
//     marginPercentage: 16.67,
//     ...
//   },
// ]
```

## CRITÉRIOS DE PRONTO

- ✅ Sistema mostra onde se ganha e onde se perde dinheiro
- ✅ Margem é explicável
- ✅ Humano decide ações
- ✅ Consolidação de receita, fees, payouts e holding cost
- ✅ Agregação por variante, actor e canal
- ✅ READ-ONLY: Nenhuma mutação

## PRÓXIMOS PASSOS

- [ ] Testar queries com dados reais
- [ ] Otimizar queries para grandes volumes
- [ ] Adicionar índices se necessário
- [ ] Testes de integração
- [ ] UI mínima para visualização de margens

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Consolidação:** Apenas consolida dados existentes, não recalcula
3. **Transparente:** Explicação clara de como a margem foi calculada
4. **Flexível:** Permite agregação por variante, actor ou canal
5. **Base para decisão:** Fornece dados para decisão humana sobre onde focar





