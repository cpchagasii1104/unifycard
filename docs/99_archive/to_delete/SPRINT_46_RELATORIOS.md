# SPRINT 46: RELATÓRIOS OPERACIONAIS E GERENCIAIS

## RESUMO EXECUTIVO

Implementado sistema de relatórios canônicos:
- ✅ SalesReportService (vendas)
- ✅ InventoryReportService (estoque)
- ✅ FinancialReportService (financeiro)
- ✅ Rotas REST para cada relatório
- ✅ Filtros por período, actor, canal
- ✅ Apenas consolida dados existentes (não recalcula)

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/reports/sales-report.types.ts`** (NOVO)
   - Tipos para relatórios de vendas
   - `SalesReportFilters`, `SalesReport`, `SalesByPeriod`, `SalesByChannel`, `SalesByActor`, `AverageTicket`

2. **`backend/src/modules/reports/sales-report.service.ts`** (NOVO)
   - Service para relatórios de vendas
   - Métodos: `generateReport()`, `getSummary()`, `getSalesByPeriod()`, `getSalesByChannel()`, `getSalesByActor()`, `getAverageTicketByPeriod()`

3. **`backend/src/modules/reports/inventory-report.types.ts`** (NOVO)
   - Tipos para relatórios de estoque
   - `InventoryReportFilters`, `InventoryReport`, `InventoryBalance`, `InventoryConsumption`

4. **`backend/src/modules/reports/inventory-report.service.ts`** (NOVO)
   - Service para relatórios de estoque
   - Métodos: `generateReport()`, `getBalances()`, `getConsumption()`, `calculateSummary()`

5. **`backend/src/modules/reports/financial-report.types.ts`** (NOVO)
   - Tipos para relatórios financeiros
   - `FinancialReportFilters`, `FinancialReport`, `FinancialSummary`, `FinancialByPeriod`, `FinancialBySplit`

6. **`backend/src/modules/reports/financial-report.service.ts`** (NOVO)
   - Service para relatórios financeiros
   - Métodos: `generateReport()`, `getSummary()`, `getFinancialByPeriod()`, `getFinancialBySplit()`, `getPending()`

7. **`backend/src/modules/reports/reports.routes.ts`** (NOVO)
   - Rotas REST para relatórios
   - `GET /reports/sales`, `GET /reports/inventory`, `GET /reports/financial`

8. **`backend/src/server.ts`** (ALTERADO)
   - Registrado módulo de relatórios em `/reports`

## RELATÓRIOS DE VENDAS

### Endpoint

```
GET /reports/sales?startDate=2024-01-01&endDate=2024-01-31&actorId=...&channel=PDV|MARKETPLACE|ALL
```

### Dados Retornados

```typescript
{
  period: { startDate, endDate },
  summary: {
    totalOrders: number,
    totalAmount: number,
    totalPaid: number,
    totalFailed: number,
    averageTicket: number
  },
  byPeriod: Array<{ period, totalOrders, totalAmount, totalPaid, totalFailed }>,
  byChannel: Array<{ channel, totalOrders, totalAmount, totalPaid }>,
  byActor: Array<{ actorId, totalOrders, totalAmount, totalPaid }>,
  averageTicketByPeriod: Array<{ period, averageTicket, totalOrders, totalAmount }>
}
```

### Fonte de Dados

- `orders` (pedidos)
- `payment_transactions` (transações de pagamento)
- `payment_intents` (intenções de pagamento)

## RELATÓRIOS DE ESTOQUE

### Endpoint

```
GET /reports/inventory?variantId=...&productId=...&startDate=...&endDate=...
```

### Dados Retornados

```typescript
{
  period: { startDate?, endDate? },
  balances: Array<{
    productVariantId: string,
    variantName?: string,
    currentQuantity: number,
    reservedQuantity: number,
    availableQuantity: number,
    unit: string
  }>,
  consumption: Array<{
    period: string,
    variantId: string,
    variantName?: string,
    consumedQuantity: number,
    unit: string
  }>,
  summary: {
    totalVariants: number,
    totalCurrentQuantity: number,
    totalReservedQuantity: number,
    totalAvailableQuantity: number
  }
}
```

### Fonte de Dados

- `inventory_movements` (movimentações)
- `inventory_reservations` (reservas)
- `product_variants` (variantes)

## RELATÓRIOS FINANCEIROS

### Endpoint

```
GET /reports/financial?startDate=2024-01-01&endDate=2024-01-31&actorId=...
```

### Dados Retornados

```typescript
{
  period: { startDate, endDate },
  summary: {
    totalReceived: number,
    totalPaidOut: number,
    platformFees: number,
    pendingAmount: number,
    failedAmount: number
  },
  byPeriod: Array<{ period, totalReceived, totalPaidOut, platformFees }>,
  bySplit: Array<{ role, totalAmount, totalPayouts, successfulPayouts, failedPayouts }>,
  pending: Array<{
    paymentIntentId: string,
    orderId: string,
    amount: number,
    status: string,
    errorCode?: string
  }>
}
```

### Fonte de Dados

- `payment_transactions` (transações de pagamento)
- `payout_transactions` (transações de repasse)
- `payment_splits` (divisões de pagamento)

## REGRAS ARQUITETURAIS

### ✅ Não Cria Nova Lógica Econômica

- Relatórios apenas **consolidam** dados existentes
- Não recalcula valores
- Não cria novas regras de negócio

### ✅ Apenas Leitura

- Relatórios são **read-only**
- Não alteram dados
- Não executam transações

### ✅ Fonte de Verdade

- Dados vêm diretamente das tabelas canônicas
- Não há cache ou pré-cálculo
- Sempre reflete estado atual

## FILTROS DISPONÍVEIS

### Vendas

- `startDate`: Data inicial (padrão: últimos 30 dias)
- `endDate`: Data final (padrão: hoje)
- `actorId`: Filtrar por actor (comprador ou vendedor)
- `channel`: `PDV`, `MARKETPLACE`, `ALL` (padrão: `ALL`)

### Estoque

- `variantId`: Filtrar por variante específica
- `productId`: Filtrar por produto
- `startDate`: Data inicial para consumo
- `endDate`: Data final para consumo

### Financeiro

- `startDate`: Data inicial (padrão: últimos 30 dias)
- `endDate`: Data final (padrão: hoje)
- `actorId`: Filtrar por actor

## TESTES MANUAIS

### 1. Relatório de Vendas

```bash
# Últimos 30 dias
GET /reports/sales

# Período específico
GET /reports/sales?startDate=2024-01-01&endDate=2024-01-31

# Por canal
GET /reports/sales?channel=PDV

# Por actor
GET /reports/sales?actorId=...
```

### 2. Relatório de Estoque

```bash
# Todos os produtos
GET /reports/inventory

# Por produto
GET /reports/inventory?productId=...

# Por variante
GET /reports/inventory?variantId=...

# Consumo por período
GET /reports/inventory?startDate=2024-01-01&endDate=2024-01-31
```

### 3. Relatório Financeiro

```bash
# Últimos 30 dias
GET /reports/financial

# Período específico
GET /reports/financial?startDate=2024-01-01&endDate=2024-01-31

# Por actor
GET /reports/financial?actorId=...
```

## OBSERVAÇÕES

1. **Consolidação apenas**: Relatórios não criam nova lógica, apenas consolidam
2. **Fonte de verdade**: Dados vêm diretamente das tabelas canônicas
3. **Read-only**: Relatórios não alteram dados
4. **Filtros flexíveis**: Permite análise por período, actor, canal
5. **Performance**: Queries otimizadas com índices existentes

## PRÓXIMOS PASSOS

- [ ] Adicionar cache opcional para relatórios pesados
- [ ] Adicionar exportação (CSV, PDF)
- [ ] Adicionar gráficos no frontend
- [ ] Adicionar relatórios customizados





