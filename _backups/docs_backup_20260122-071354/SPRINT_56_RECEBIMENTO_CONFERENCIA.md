# SPRINT 56: RECEBIMENTO COM CONFERÊNCIA E DIVERGÊNCIA

## RESUMO EXECUTIVO

Implementado sistema de conferência de recebimento de transferências:
- ✅ Conferência explícita antes de dar entrada no estoque
- ✅ Registro de divergências (faltando, quantidade errada, lote errado, avaria)
- ✅ Estoque só entra após conferência finalizada
- ✅ Apenas quantidade recebida entra em estoque
- ✅ Divergências são informativas e auditáveis

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/191_create_stock_transfer_receipts.sql`** (NOVO)
   - Tabela `stock_transfer_receipts` (append-only)
   - Tabela `stock_transfer_receipt_items` (append-only)
   - Enum: `stock_transfer_receipt_status`
   - Atualização do enum `stock_transfer_status` para incluir `RECEIVING`

2. **`backend/src/modules/marketplace/stock-transfer-receipt.types.ts`** (NOVO)
   - Tipos TypeScript para conferência
   - `StockTransferReceipt`, `StockTransferReceiptItem`, etc.

3. **`backend/src/modules/marketplace/stock-transfer-receipt.repository.ts`** (NOVO)
   - Repository para conferência
   - Métodos: `createReceipt`, `getReceiptById`, `createReceiptItem`, etc.

4. **`backend/src/modules/marketplace/stock-transfer-receipt.service.ts`** (NOVO)
   - Service para conferência
   - Métodos: `startReceipt`, `receiveItem`, `finalizeReceipt`

5. **`backend/src/modules/marketplace/stock-transfer.types.ts`** (ALTERADO)
   - Adicionado `RECEIVING` ao tipo `StockTransferStatus`

6. **`backend/src/modules/marketplace/stock-transfer.service.ts`** (ALTERADO)
   - `receiveTransfer()` agora apenas inicia conferência (muda para RECEIVING)
   - Cancelamento não permite se status = RECEIVING

7. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `stockTransferReceiptService` e `stockTransferReceiptRepository`
   - Exporta tipos de conferência

## MODELO DE DADOS

### Tabela `stock_transfer_receipts`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `stock_transfer_id`: UUID
- `received_by_user_id`: UUID
- `received_at`: TIMESTAMP
- `status`: `IN_PROGRESS` | `PARTIAL` | `COMPLETE` | `REJECTED`
- `notes`: TEXT (opcional)
- `metadata`: JSONB
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem DELETE)
- Status controla estado da conferência

### Tabela `stock_transfer_receipt_items`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `receipt_id`: UUID
- `stock_transfer_item_id`: UUID
- `expected_quantity`: NUMERIC(20, 4) (do item original)
- `received_quantity`: NUMERIC(20, 4) (física, pode ser diferente)
- `inventory_lot_id`: UUID (opcional, pode ser diferente do esperado)
- `discrepancy_reason`: TEXT (opcional)
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem DELETE)
- Compara quantidade esperada vs recebida
- Permite registrar motivo da divergência

## FLUXO DE CONFERÊNCIA

### 1. Iniciar Conferência

```typescript
// stockTransferReceiptService.startReceipt(transferId, receivedByUserId)
// → Cria stock_transfer_receipt com status IN_PROGRESS
// → Muda transfer.status para RECEIVING
```

**Regras:**
- Só pode iniciar se transfer.status = `SHIPPED`
- Se já existe receipt não rejeitado, retorna existente

### 2. Conferir Itens

```typescript
// stockTransferReceiptService.receiveItem(receiptId, itemId, receivedQty, lotId?, reason?)
// → Cria stock_transfer_receipt_item
// → Compara expected_quantity vs received_quantity
// → Registra divergência se houver
```

**Regras:**
- Só pode conferir se receipt.status = `IN_PROGRESS`
- Cada item só pode ser conferido uma vez
- Pode especificar `inventory_lot_id` diferente do esperado
- Pode registrar `discrepancy_reason`

### 3. Finalizar Conferência

```typescript
// stockTransferReceiptService.finalizeReceipt(receiptId)
// → Determina status final (COMPLETE, PARTIAL ou REJECTED)
// → Gera inventory_movements IN apenas para received_quantity > 0
// → Apenas received_quantity entra em estoque
// → Muda transfer.status para RECEIVED (se não REJECTED)
```

**Regras:**
- Só pode finalizar se receipt.status = `IN_PROGRESS`
- Status final:
  - `COMPLETE`: Todos os itens recebidos conforme esperado
  - `PARTIAL`: Alguns itens divergentes ou faltando
  - `REJECTED`: Nenhum item recebido (todos rejeitados)
- Inventory_movements IN só são criados aqui
- Apenas `received_quantity` entra em estoque (não `expected_quantity`)

## INTEGRAÇÕES

### Stock Transfer

**Antes (SPRINT 55):**
- `receiveTransfer()` → gerava movements IN imediatamente

**Agora (SPRINT 56):**
- `receiveTransfer()` → apenas muda status para `RECEIVING`
- Conferência via `stockTransferReceiptService`
- Movements IN só são gerados após `finalizeReceipt()`

### Status da Transferência

**Novo fluxo:**
- `DRAFT` → `SHIPPED` → `RECEIVING` → `RECEIVED`
- `RECEIVING`: Conferência em andamento
- `RECEIVED`: Conferência finalizada (COMPLETE ou PARTIAL)
- Se receipt `REJECTED`, transfer permanece em `RECEIVING`

### Inventory Movements

**SHIP (inalterado):**
- Gera movements OUT no `from_actor`

**RECEIVE (alterado):**
- Movements IN só são gerados após `finalizeReceipt()`
- Apenas `received_quantity` entra em estoque
- Metadata inclui informações de divergência

## GUARDRAILS

### ✅ Respeitados

1. **NÃO ajustar estoque automaticamente**
   - Divergências são registradas, não corrigidas
   - Estoque reflete apenas quantidade recebida

2. **NÃO criar compensação invisível**
   - Tudo explícito e auditável
   - Divergências ficam registradas

3. **Divergência é informativa e auditável**
   - `discrepancy_reason` registra motivo
   - `expected_quantity` vs `received_quantity` comparados
   - Metadata inclui informações de divergência

4. **Decisão humana vem depois**
   - Sistema não toma decisões automáticas
   - Divergências ficam registradas para análise

## EXEMPLOS DE DIVERGÊNCIA

### Faltando Itens
```typescript
// Item esperado: 10 unidades
// Item recebido: 8 unidades
// discrepancy_reason: "Faltando 2 unidades"
// → received_quantity = 8 entra em estoque
// → Divergência registrada
```

### Lote Errado
```typescript
// Item esperado: lote ABC123
// Item recebido: lote XYZ789
// discrepancy_reason: "Lote diferente do esperado"
// → received_quantity entra com lote XYZ789
// → Divergência registrada
```

### Avaria
```typescript
// Item esperado: 10 unidades
// Item recebido: 0 unidades
// discrepancy_reason: "Avaria total, item rejeitado"
// → received_quantity = 0, não entra em estoque
// → Status pode ser PARTIAL ou REJECTED
```

## CRITÉRIOS DE PRONTO

- ✅ Recebimento reflete realidade física
- ✅ Estoque só entra após conferência
- ✅ Divergências ficam registradas
- ✅ Apenas quantidade recebida entra em estoque
- ✅ NÃO ajusta estoque automaticamente

## PRÓXIMOS PASSOS

- [ ] Criar rotas/endpoints para conferência
- [ ] Criar UI mínima para conferência (listagem, conferir itens, finalizar)
- [ ] Adicionar permissões canônicas para conferência
- [ ] Testes de integração
- [ ] Relatórios de divergências

## OBSERVAÇÕES

1. **Conferência é obrigatória:** Não é possível receber sem conferir
2. **Divergências são informativas:** Sistema não corrige automaticamente
3. **Estoque reflete realidade:** Apenas quantidade recebida entra
4. **Auditabilidade:** Tudo é append-only, histórico completo
5. **Flexibilidade:** Permite receber parcialmente, rejeitar itens, etc.





