# SPRINT 58: SLA LOGÍSTICO E AGING DE ESTOQUE (READ-ONLY)

## RESUMO EXECUTIVO

Implementado sistema de SLA logístico e aging de estoque:
- ✅ Aging de estoque (tempo que itens ficam parados)
- ✅ SLA de transferências (tempo entre estados)
- ✅ Flags de atraso (configuráveis)
- ✅ READ-ONLY: Nenhuma mutação de estado
- ✅ Base para decisão humana

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/inventory-sla.types.ts`** (NOVO)
   - Tipos TypeScript para aging e SLA
   - `StockAging`, `TransferSla`, `GetStockAgingOptions`, `GetTransferSlaOptions`, `SlaConfig`

2. **`backend/src/modules/marketplace/inventory-sla.service.ts`** (NOVO)
   - Service para cálculos de aging e SLA
   - Métodos: `getStockAging()`, `getTransferSla()`, `getOverdueTransfers()`
   - READ-ONLY: Nenhuma mutação

3. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `inventorySlaService`
   - Exporta tipos de SLA

## MODELO DE DADOS

### StockAging (Aging de Estoque)

**Campos:**
- `productVariantId`: string
- `actorId`: string (TODO: adicionar quando disponível)
- `currentQuantity`: number
- `unit`: string
- `daysInStock`: number (dias desde último movimento IN)
- `lastMovementAt`: Date | null
- `lastMovementType`: 'IN' | 'OUT' | 'ADJUSTMENT' | null

**Cálculo:**
- Baseado em `inventory_movements`
- Calcula saldo atual (soma de IN - OUT + ADJUSTMENT)
- Identifica último movimento IN
- Calcula dias desde último IN até hoje

### TransferSla (SLA de Transferência)

**Campos:**
- `stockTransferId`: string
- `fromActorId`: string
- `toActorId`: string
- `status`: 'DRAFT' | 'SHIPPED' | 'RECEIVING' | 'RECEIVED' | 'CANCELLED'
- `daysInDraft`: number | null
- `daysShippedToReceiving`: number | null (tempo entre SHIPPED → RECEIVING)
- `daysReceivingToReceived`: number | null (tempo entre RECEIVING → RECEIVED)
- `totalDays`: number | null (tempo total SHIPPED → RECEIVED)
- `isOverdue`: boolean (flag de atraso)
- `overdueReason`: string | undefined (motivo do atraso)

**Cálculo:**
- Baseado em `stock_transfers` e `stock_transfer_receipts`
- Calcula tempos entre estados
- Verifica se excedeu SLA configurado

## FLUXO DE CÁLCULO

### 1. Aging de Estoque

```typescript
// inventorySlaService.getStockAging(tenantId, options)
// → Calcula saldo atual por variante
// → Identifica último movimento IN
// → Calcula dias desde último IN
// → Filtra por minDaysInStock / maxDaysInStock (opcional)
```

**Fonte de dados:**
- `inventory_movements` (append-only)
- Agrega por `product_variant_id`
- Calcula saldo: `SUM(IN) - SUM(OUT) + SUM(ADJUSTMENT)`

### 2. SLA de Transferências

```typescript
// inventorySlaService.getTransferSla(tenantId, options, config)
// → Busca stock_transfers
// → Busca stock_transfer_receipts (para RECEIVING)
// → Calcula tempos entre estados
// → Verifica se excedeu SLA (configurável)
```

**Fonte de dados:**
- `stock_transfers` (status, dates)
- `stock_transfer_receipts` (quando RECEIVING começou)

**SLA padrão (configurável):**
- `maxDaysShippedToReceiving`: 3 dias (SHIPPED → RECEIVING)
- `maxDaysReceivingToReceived`: 1 dia (RECEIVING → RECEIVED)

### 3. Transferências Atrasadas

```typescript
// inventorySlaService.getOverdueTransfers(tenantId, options, config)
// → Wrapper para getTransferSla com onlyOverdue=true
// → Retorna apenas transferências que excederam SLA
```

## INTEGRAÇÕES

### Inventory Movements

**Aging:**
- Lê `inventory_movements` (read-only)
- Calcula saldo atual
- Identifica último movimento IN
- Calcula dias desde último IN

### Stock Transfers

**SLA:**
- Lê `stock_transfers` (read-only)
- Lê `stock_transfer_receipts` (read-only)
- Calcula tempos entre estados
- Verifica atrasos

## GUARDRAILS

### ✅ Respeitados

1. **NÃO criar automação**
   - Apenas cálculos read-only
   - Nenhuma ação automática

2. **NÃO criar alertas automáticos**
   - Flags de atraso são informativas
   - Decisão humana vem depois

3. **NÃO mover estoque**
   - Apenas leitura de movements
   - Nenhuma mutação

4. **NÃO ajustar dados**
   - Apenas consultas
   - Nenhuma atualização

## EXEMPLOS DE USO

### Aging de Estoque

```typescript
// Buscar itens com mais de 30 dias parados
const aging = await inventorySlaService.getStockAging(tenantId, {
  minDaysInStock: 30,
  limit: 50,
});

// Resultado:
// [
//   {
//     productVariantId: '...',
//     currentQuantity: 100,
//     daysInStock: 45,
//     lastMovementAt: new Date('2024-01-01'),
//   },
//   ...
// ]
```

### SLA de Transferências

```typescript
// Buscar transferências atrasadas
const overdue = await inventorySlaService.getOverdueTransfers(
  tenantId,
  {
    fromActorId: '...',
  },
  {
    maxDaysShippedToReceiving: 3,
    maxDaysReceivingToReceived: 1,
  }
);

// Resultado:
// [
//   {
//     stockTransferId: '...',
//     status: 'SHIPPED',
//     daysShippedToReceiving: null,
//     isOverdue: true,
//     overdueReason: 'Atrasado: 5.2 dias desde SHIPPED (SLA: 3 dias)',
//   },
//   ...
// ]
```

## CRITÉRIOS DE PRONTO

- ✅ Visibilidade de tempo real
- ✅ Nenhuma mutação de estado
- ✅ Base para decisão humana
- ✅ Aging de estoque calculado
- ✅ SLA de transferências calculado
- ✅ Flags de atraso configuráveis

## PRÓXIMOS PASSOS

- [ ] Criar endpoints read-only para relatórios
  - `GET /reports/inventory/aging`
  - `GET /reports/transfers/sla`
- [ ] Adicionar `actor_id` em `inventory_movements` (se necessário)
- [ ] Criar UI mínima para visualização
- [ ] Testes de integração

## OBSERVAÇÕES

1. **READ-ONLY:** Tudo é apenas leitura, sem mutações
2. **Configurável:** SLA pode ser configurado por chamada
3. **Informativo:** Flags de atraso são informativas, não executivas
4. **Base para decisão:** Fornece dados para decisão humana
5. **Performance:** Queries otimizadas com índices existentes





