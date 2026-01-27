# SPRINT 57: AJUSTES DE ESTOQUE (AVARIA, PERDA, SOBRA)

## RESUMO EXECUTIVO

Implementado sistema de ajustes explícitos de estoque:
- ✅ Ajustes são explícitos e humanos
- ✅ Gera inventory_movement ADJUSTMENT automaticamente
- ✅ Não automatiza após conferência
- ✅ Não compensa automaticamente
- ✅ Tudo auditável e reversível

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/192_create_inventory_adjustments.sql`** (NOVO)
   - Tabela `inventory_adjustments` (append-only)
   - Enums: `inventory_adjustment_type`, `inventory_adjustment_reference_type`
   - Triggers para prevenir DELETE

2. **`backend/src/modules/marketplace/inventory-adjustment.types.ts`** (NOVO)
   - Tipos TypeScript para ajustes
   - `InventoryAdjustment`, `CreateInventoryAdjustmentInput`, etc.

3. **`backend/src/modules/marketplace/inventory-adjustment.repository.ts`** (NOVO)
   - Repository para ajustes
   - Métodos: `createAdjustment`, `getAdjustmentById`, `listAdjustments`

4. **`backend/src/modules/marketplace/inventory-adjustment.service.ts`** (NOVO)
   - Service para ajustes
   - Métodos: `createAdjustment`, `listAdjustments`, `listAdjustmentsByReference`
   - Gera `inventory_movement ADJUSTMENT` automaticamente

5. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `inventoryAdjustmentService` e `inventoryAdjustmentRepository`
   - Exporta tipos de ajuste

## MODELO DE DADOS

### Tabela `inventory_adjustments`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `actor_id`: UUID (unidade organizacional)
- `product_variant_id`: UUID
- `inventory_lot_id`: UUID (opcional)
- `adjustment_type`: `LOSS` | `DAMAGE` | `SURPLUS`
- `quantity`: NUMERIC(20, 4) (signed)
- `reason`: TEXT (obrigatório)
- `reference_type`: `RECEIPT` | `MANUAL` (opcional)
- `reference_id`: UUID (opcional)
- `created_by_user_id`: UUID
- `metadata`: JSONB
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem DELETE)
- `quantity` signed:
  - `LOSS` / `DAMAGE` → negativa
  - `SURPLUS` → positiva
- `reason` é obrigatório

## FLUXO DE AJUSTE

### 1. Criar Ajuste

```typescript
// inventoryAdjustmentService.createAdjustment(tenantId, input, userId)
// → Valida tipo e quantidade
// → Cria inventory_adjustment
// → Gera inventory_movement ADJUSTMENT automaticamente
```

**Validações:**
- Variante existe
- Lote existe e pertence à variante (se informado)
- Quantidade compatível com tipo:
  - `LOSS` / `DAMAGE` → deve ser negativa
  - `SURPLUS` → deve ser positiva
- `reason` é obrigatório

### 2. Geração Automática de Movement

**Quando ajuste é criado:**
- Gera `inventory_movement` do tipo `ADJUSTMENT`
- `quantity` = quantidade do ajuste (signed)
- `reason` = `AJUSTE_{TYPE}: {reason}`
- `referenceType` = `'inventory_adjustment'`
- `referenceId` = `adjustment.id`
- Metadata inclui informações do ajuste

### 3. Referências

**Ajuste pode referenciar:**
- `RECEIPT` → `stock_transfer_receipt.id`
- `MANUAL` → sem referência específica

**Uso:**
- Após conferência com divergência, usuário pode criar ajuste referenciando o receipt
- Ajuste manual para perdas/sobras não relacionadas a transferências

## INTEGRAÇÕES

### Inventory Movements

**ADJUSTMENT:**
- Gera movement automaticamente quando ajuste é criado
- `quantity` signed (negativa para LOSS/DAMAGE, positiva para SURPLUS)
- `referenceType = 'inventory_adjustment'`
- `referenceId = adjustment.id`

### Stock Transfer Receipts

**Integração (não automática):**
- Após conferência com divergência, usuário pode criar ajuste
- Ajuste pode referenciar `stock_transfer_receipt` via `referenceType = 'RECEIPT'`
- NÃO automatiza: decisão humana vem antes

## GUARDRAILS

### ✅ Respeitados

1. **NÃO compensar automaticamente**
   - Ajuste é explícito e humano
   - Não cria ajuste automático após conferência

2. **NÃO recalcular estoque**
   - Estoque é derivado de movements
   - Ajuste apenas adiciona novo movement

3. **NÃO "corrigir" divergência**
   - Divergência permanece registrada
   - Ajuste é ato separado e explícito

4. **Ajuste é ato explícito e auditável**
   - Tudo é append-only
   - Histórico completo preservado

## EXEMPLOS DE USO

### Perda após Conferência

```typescript
// Conferência detectou: esperado 10, recebido 8
// Usuário cria ajuste:
await inventoryAdjustmentService.createAdjustment(tenantId, {
  actorId: toActorId,
  productVariantId: variantId,
  adjustmentType: 'LOSS',
  quantity: -2, // Negativa
  reason: 'Faltando 2 unidades após conferência',
  referenceType: 'RECEIPT',
  referenceId: receiptId,
}, userId);
// → Gera movement ADJUSTMENT com quantity = -2
```

### Avaria

```typescript
// Item avariado encontrado
await inventoryAdjustmentService.createAdjustment(tenantId, {
  actorId: actorId,
  productVariantId: variantId,
  inventoryLotId: lotId,
  adjustmentType: 'DAMAGE',
  quantity: -1, // Negativa
  reason: 'Avaria detectada durante conferência',
  referenceType: 'RECEIPT',
  referenceId: receiptId,
}, userId);
// → Gera movement ADJUSTMENT com quantity = -1
```

### Sobra

```typescript
// Item a mais encontrado
await inventoryAdjustmentService.createAdjustment(tenantId, {
  actorId: actorId,
  productVariantId: variantId,
  adjustmentType: 'SURPLUS',
  quantity: 1, // Positiva
  reason: 'Sobra encontrada no estoque',
  referenceType: 'MANUAL',
}, userId);
// → Gera movement ADJUSTMENT com quantity = 1
```

## CRITÉRIOS DE PRONTO

- ✅ Toda divergência pode virar ajuste
- ✅ Histórico preservado
- ✅ Estoque final reflete realidade
- ✅ Ajuste gera movement ADJUSTMENT
- ✅ NÃO automatiza após conferência

## PRÓXIMOS PASSOS

- [ ] Criar rotas/endpoints para ajustes
- [ ] Criar UI mínima para ajustes (listagem, criação)
- [ ] Adicionar permissões canônicas para ajustes
- [ ] Testes de integração
- [ ] Relatórios de ajustes

## OBSERVAÇÕES

1. **Ajuste é explícito:** Não automatiza após conferência
2. **Histórico preservado:** Tudo é append-only
3. **Estoque reflete realidade:** Movements ADJUSTMENT alteram saldo
4. **Auditabilidade:** Tudo é rastreável e reversível
5. **Flexibilidade:** Permite ajustes manuais e referenciados





