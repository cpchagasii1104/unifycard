# SPRINT 49: DASHBOARDS OPERACIONAIS (BI INTERNO)

## RESUMO EXECUTIVO

Implementado sistema de dashboards operacionais que visualiza relatórios existentes:
- ✅ DashboardService que agrega dados dos relatórios
- ✅ Endpoints REST para dashboards
- ✅ Frontend com cards e gráficos simples

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/dashboard/dashboard.types.ts`** (NOVO)
   - Tipos TypeScript para dashboards
   - `DashboardFilters`, `TodayOverview`, `MonthOverview`, `ChannelSplit`, `DashboardOverview`

2. **`backend/src/modules/dashboard/dashboard.service.ts`** (NOVO)
   - Service principal para dashboards
   - Métodos:
     - `getOverview()`: Visão geral completa
     - `getTodayOverview()`: Visão do dia
     - `getMonthOverview()`: Visão do mês
     - `getChannelSplit()`: Divisão por canal
     - `getSalesDashboard()`: Dashboard de vendas
     - `getInventoryDashboard()`: Dashboard de estoque
   - Usa `SalesReportService`, `FinancialReportService`, `InventoryReportService`

3. **`backend/src/modules/dashboard/dashboard.routes.ts`** (NOVO)
   - Rotas REST:
     - `GET /dashboard/overview` - Visão geral
     - `GET /dashboard/today` - Visão do dia
     - `GET /dashboard/month` - Visão do mês
     - `GET /dashboard/sales` - Dashboard de vendas
     - `GET /dashboard/inventory` - Dashboard de estoque

4. **`backend/src/server.ts`** (ALTERADO)
   - Registrado módulo de dashboards em `/dashboard`

### Frontend

5. **`frontend/src/api/dashboard.ts`** (NOVO)
   - API client para dashboards
   - Funções: `getDashboardOverview`, `getTodayOverview`, `getMonthOverview`, `getSalesDashboard`, `getInventoryDashboard`

6. **`frontend/src/pages/DashboardPage.tsx`** (NOVO)
   - Página de dashboard operacional
   - Cards: Vendas hoje, Faturamento, Ticket médio, Estoque crítico
   - Gráficos simples (barras) para tendências
   - Tabela de estoque crítico

7. **`frontend/src/pages/DashboardPage.css`** (NOVO)
   - Estilos para dashboard

## REGRAS ARQUITETURAIS

### ✅ Não Recalcula Regras

- Dashboard usa relatórios existentes
- Não cria métricas novas
- Apenas agrega e visualiza dados

### ✅ Dashboard = Visualização de Relatórios

- `DashboardService` chama `SalesReportService`, `FinancialReportService`, `InventoryReportService`
- Não duplica lógica de cálculo
- Mesmos números dos relatórios

## ESTRUTURA DO DASHBOARD

### Visão do Dia

```typescript
{
  date: Date;
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  inventory: {
    totalVariants: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  financial: {
    totalReceived: number;
    pendingAmount: number;
    failedAmount: number;
  };
}
```

### Visão do Mês

```typescript
{
  month: string; // 'YYYY-MM'
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  financial: {
    totalReceived: number;
    totalPaidOut: number;
    platformFees: number;
  };
  trends: {
    dailySales: Array<{
      date: string;
      amount: number;
      orders: number;
    }>;
  };
}
```

### Divisão por Canal

```typescript
{
  channel: 'PDV' | 'MARKETPLACE';
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  percentage: number; // % do total
}
```

## ENDPOINTS

### GET /dashboard/overview

Obtém visão geral completa do dashboard.

**Query params:**
- `actorId`: ID do ator (opcional)
- `channel`: Canal (PDV, MARKETPLACE, ALL) (opcional)

**Response:**
```json
{
  "today": { ... },
  "month": { ... },
  "channels": [ ... ],
  "inventory": { ... }
}
```

### GET /dashboard/today

Obtém visão do dia.

**Query params:**
- `actorId`: ID do ator (opcional)
- `channel`: Canal (opcional)

### GET /dashboard/month

Obtém visão do mês.

**Query params:**
- `actorId`: ID do ator (opcional)
- `channel`: Canal (opcional)

### GET /dashboard/sales

Obtém dashboard de vendas.

**Query params:**
- `startDate`: Data inicial (opcional)
- `endDate`: Data final (opcional)
- `actorId`: ID do ator (opcional)
- `channel`: Canal (opcional)

### GET /dashboard/inventory

Obtém dashboard de estoque.

**Query params:**
- `variantId`: ID da variante (opcional)

## FRONTEND

### Cards do Dia

- **Vendas Hoje**: Total de pedidos do dia
- **Faturamento**: Valor recebido hoje
- **Ticket Médio**: Valor médio por pedido
- **Estoque Crítico**: Variantes com estoque baixo

### Visão do Mês

- **Total de Pedidos**: Pedidos do mês
- **Faturamento Mensal**: Valor recebido no mês
- **Taxas/Plataforma**: Taxas cobradas
- **Repassado**: Valor repassado aos vendedores

### Divisão por Canal

- Cards para cada canal (PDV, MARKETPLACE)
- Estatísticas: Pedidos, Faturamento, Ticket Médio, Participação

### Estoque Crítico

- Tabela com variantes com estoque < 10
- Colunas: Variante, Estoque Real, Reservado, Disponível

### Gráfico de Tendências

- Gráfico de barras simples
- Últimos 7 dias de vendas
- Altura proporcional ao valor

## INTEGRAÇÃO COM RELATÓRIOS

### SalesReportService

```typescript
const salesReport = await salesReportService.generateReport(tenantId, filters);
// Usa: salesReport.summary, salesReport.byPeriod, salesReport.byChannel, salesReport.byActor
```

### FinancialReportService

```typescript
const financialReport = await financialReportService.generateReport(tenantId, filters);
// Usa: financialReport.summary
```

### InventoryReportService

```typescript
const inventoryReport = await inventoryReportService.generateReport(tenantId, {});
// Usa: inventoryReport.summary, inventoryReport.balances
```

## OBSERVAÇÕES

1. **Visualização apenas**: Dashboard não recalcula, apenas visualiza
2. **Mesmos números**: Dashboard usa exatamente os mesmos dados dos relatórios
3. **Rápido e confiável**: Agregações simples, sem lógica complexa
4. **Operação diária**: Focado em visão do dia e mês
5. **Detecção rápida**: Estoque crítico e problemas visíveis

## PRÓXIMOS PASSOS

- [ ] Adicionar filtros de período no frontend
- [ ] Adicionar gráficos mais elaborados (se necessário)
- [ ] Adicionar exportação de dados
- [ ] Adicionar alertas automáticos para estoque crítico





