# SPRINT 70: ACCOUNTS PAYABLE (CONTAS A PAGAR)

**Data:** 2024-12-19  
**Objetivo:** Criar núcleo de contas a pagar do ERP, integrado com Purchase Orders e Scheduled Actions, sem executar pagamento automaticamente.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migration Criada

**Arquivo:**
- `backend/migrations/199_create_accounts_payable.sql` - Tabela `accounts_payable`

**Estrutura:**

**accounts_payable:**
- Status: `OPEN`, `SCHEDULED`, `PAID`, `CANCELLED`
- Campos: supplier_id, reference_type (PURCHASE_ORDER | MANUAL), reference_id, amount_cents, currency, due_date, scheduled_action_id (nullable), etc.
- RLS habilitado
- Índices para performance
- Constraint: scheduled_action_id só pode ser preenchido se status = SCHEDULED

### 1.2. Service Criado

**AccountsPayableService:**
- `createFromPurchaseOrder()` - Cria conta a partir de PO (chamado automaticamente quando PO é RECEIVED)
- `createManualPayable()` - Cria conta manual
- `schedulePayment()` - Agenda pagamento (cria scheduled_action)
- `markAsPaid()` - Marca conta como paga
- `cancelPayable()` - Cancela conta
- `listPayables()` - Lista contas com filtros
- `getPayableById()` - Busca conta por ID

### 1.3. Integrações

**createFromPurchaseOrder → Purchase Orders:**
- Quando PO é RECEIVED, calcula total dos itens recebidos
- Cria conta a pagar automaticamente
- `reference_type = 'PURCHASE_ORDER'`
- `reference_id = purchase_order_id`
- `due_date` = 30 dias após recebimento (ou expected_delivery_date + 30 dias)

**schedulePayment → Scheduled Actions:**
- Cria `scheduled_action` tipo `PAYMENT_EXECUTION`
- `reference_type = 'accounts_payable'`
- `reference_id = payable_id`
- Vincula `scheduled_action_id` na conta
- Status da conta → `SCHEDULED`

**executePayment (Scheduled Action):**
- Quando scheduled_action executa, marca payable como pago
- Futuro: criar PaymentIntent e executar pagamento real

### 1.4. Rotas REST

**Accounts Payable:**
- `POST /accounts-payable/from-purchase-order` - Cria conta a partir de PO
- `POST /accounts-payable/manual` - Cria conta manual
- `GET /accounts-payable` - Lista contas
- `GET /accounts-payable/:id` - Busca conta
- `POST /accounts-payable/:id/schedule` - Agenda pagamento
- `POST /accounts-payable/:id/mark-paid` - Marca como paga
- `POST /accounts-payable/:id/cancel` - Cancela conta

---

## 2. ESTRUTURA DE DADOS

### 2.1. accounts_payable

```sql
CREATE TABLE accounts_payable (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    reference_type accounts_payable_reference_type NOT NULL, -- PURCHASE_ORDER | MANUAL
    reference_id UUID NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    due_date DATE NOT NULL,
    status accounts_payable_status NOT NULL DEFAULT 'OPEN',
    scheduled_action_id UUID, -- Nullable, só preenchido se status = SCHEDULED
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by_actor_id UUID,
    paid_by_user_id UUID,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_actor_id UUID,
    cancelled_by_user_id UUID,
    cancellation_reason TEXT,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. LIFECYCLE DE CONTA A PAGAR

### 3.1. Transições de Status

```
OPEN → SCHEDULED → PAID
  ↓         ↓
CANCELLED CANCELLED
```

**Regras:**
- OPEN: Conta criada, não agendada
- SCHEDULED: Conta agendada (tem scheduled_action)
- PAID: Conta paga
- CANCELLED: Conta cancelada (apenas OPEN ou SCHEDULED)

### 3.2. Validações

**Ao Criar:**
- `supplier_id` deve existir
- `amount_cents > 0`
- `due_date` deve ser válida

**Ao Agendar:**
- Conta deve estar em OPEN
- `scheduledFor` deve ser no futuro

**Ao Marcar como Paga:**
- Conta deve estar em OPEN ou SCHEDULED

**Ao Cancelar:**
- Conta deve estar em OPEN ou SCHEDULED
- Se tiver scheduled_action, cancela também

---

## 4. INTEGRAÇÃO COM PURCHASE ORDERS

### 4.1. Criação Automática

**Quando:** `receivePO()` é chamado e ordem é marcada como RECEIVED

**O que é criado:**
- Conta a pagar com `reference_type = 'PURCHASE_ORDER'`
- `amount_cents` = soma dos itens recebidos (proporcional)
- `due_date` = 30 dias após recebimento (ou expected_delivery_date + 30 dias)

**Exemplo:**
```typescript
// No receivePO(), após criar inventory movements:
if (totalAmountCents > 0) {
  await accountsPayableService.createFromPurchaseOrder(tenantId, {
    purchaseOrderId: orderId,
    amountCents: totalAmountCents,
    currency: 'BRL',
    dueDate: dueDate,
  }, order.createdByActorId, receivedByUserId);
}
```

### 4.2. Cálculo de Valor

**Lógica:**
- Para cada item recebido, calcular proporção: `quantityReceived / quantityOrdered`
- Valor proporcional: `item.totalPriceCents * proportion`
- Soma de todos os itens recebidos

---

## 5. INTEGRAÇÃO COM SCHEDULED ACTIONS

### 5.1. Agendamento de Pagamento

**Quando:** `schedulePayment()` é chamado

**O que é criado:**
- `scheduled_action` tipo `PAYMENT_EXECUTION`
- `reference_type = 'accounts_payable'`
- `reference_id = payable_id`
- `scheduled_action_id` vinculado na conta
- Status da conta → `SCHEDULED`

**Exemplo:**
```typescript
const scheduledAction = await scheduledActionService.scheduleAction(tenantId, {
  actionType: 'PAYMENT_EXECUTION',
  referenceType: 'accounts_payable',
  referenceId: payableId,
  scheduledFor: scheduledFor,
  metadata: {
    payable_id: payableId,
    supplier_id: payable.supplierId,
    amount_cents: payable.amountCents,
  },
}, createdByActorId, createdByUserId);

await accountsPayableRepository.schedulePayment(tenantId, payableId, scheduledAction.id);
```

### 5.2. Execução de Pagamento

**Quando:** `scheduled_action` executa (via `executeDueActions()`)

**O que acontece:**
- Se `reference_type = 'accounts_payable'`, marca payable como pago
- Futuro: criar PaymentIntent e executar pagamento real

**Exemplo:**
```typescript
// No scheduled-action.service.ts executePayment():
if (action.referenceType === 'accounts_payable') {
  await accountsPayableService.markAsPaid(
    tenantId,
    payable.id,
    action.createdByActorId,
    action.createdByUserId
  );
  // TODO: Futuro - criar PaymentIntent e executar pagamento real
}
```

---

## 6. AUDITORIA

### 6.1. Eventos Registrados

**Accounts Payable:**
- `ACCOUNTS_PAYABLE_CREATED_FROM_PO` - Quando conta é criada a partir de PO
- `ACCOUNTS_PAYABLE_CREATED_MANUAL` - Quando conta é criada manualmente
- `ACCOUNTS_PAYABLE_SCHEDULED` - Quando pagamento é agendado
- `ACCOUNTS_PAYABLE_PAID` - Quando conta é marcada como paga
- `ACCOUNTS_PAYABLE_CANCELLED` - Quando conta é cancelada

### 6.2. Contexto de Auditoria

Cada evento inclui:
- `payable_id`
- `purchase_order_id` (se criada a partir de PO)
- `scheduled_action_id` (se agendada)
- `status`
- `created_by_user_id` / `paid_by_user_id` / `cancelled_by_user_id`
- `cancellation_reason` (se cancelada)

---

## 7. GUARDRAILS RESPEITADOS

### 7.1. Não Criar PaymentIntent Automaticamente

- ✅ Nenhum PaymentIntent criado automaticamente
- ✅ Pagamento real será implementado no futuro quando scheduled_action executar

### 7.2. Não Emitir Fiscal

- ✅ Nenhuma emissão fiscal
- ✅ Nenhuma criação de FiscalDocument

### 7.3. Não Pagar Automaticamente

- ✅ Pagamento só ocorre quando scheduled_action executa
- ✅ Nenhum pagamento automático em background

### 7.4. Tudo Auditável

- ✅ Todas as mudanças geram audit event
- ✅ Contexto completo registrado
- ✅ Falha de auditoria não bloqueia operação

### 7.5. Append-Only

- ✅ Status muda, mas registros não desaparecem
- ✅ Histórico completo preservado

---

## 8. ARQUIVOS CRIADOS

### 8.1. Migration

1. `backend/migrations/199_create_accounts_payable.sql`

### 8.2. Types

2. `backend/src/modules/marketplace/accounts-payable.types.ts`

### 8.3. Repository

3. `backend/src/modules/marketplace/accounts-payable.repository.ts`

### 8.4. Service

4. `backend/src/modules/marketplace/accounts-payable.service.ts`

### 8.5. Routes

5. `backend/src/modules/marketplace/accounts-payable.routes.ts`

### 8.6. Integrações

6. `backend/src/modules/marketplace/purchase-order.service.ts` (atualizado - cria payable quando recebe)
7. `backend/src/modules/automation/scheduled-action.service.ts` (atualizado - suporta accounts_payable)
8. `backend/src/modules/marketplace/marketplace.routes.ts` (atualizado - registra rotas)

---

## 9. EXEMPLOS DE USO

### 9.1. Fluxo Completo: PO → Payable → Scheduled Payment

```typescript
// 1. Receber Purchase Order (cria payable automaticamente)
const result = await purchaseOrderService.receivePO(tenantId, orderId, {
  items: [
    { itemId: 'item-123', quantityReceived: 100 },
  ],
}, 'user-123');

// 2. Buscar conta criada
const payables = await accountsPayableService.listPayables(tenantId, {
  referenceType: 'PURCHASE_ORDER',
  referenceId: orderId,
});
const payable = payables[0]; // Conta criada automaticamente

// 3. Agendar pagamento
const scheduledPayable = await accountsPayableService.schedulePayment(
  tenantId,
  payable.id,
  {
    scheduledFor: new Date('2024-12-25T10:00:00Z'),
  },
  'actor-123',
  'user-123'
);

// 4. Quando scheduled_action executar (automaticamente ou manualmente):
// - payable.status → PAID
// - payable.paid_at preenchido
```

### 9.2. Criar Conta Manual

```typescript
// Criar conta manual
const payable = await accountsPayableService.createManualPayable(tenantId, {
  supplierId: 'supplier-123',
  amountCents: 50000, // R$ 500,00
  currency: 'BRL',
  dueDate: new Date('2024-12-31'),
  description: 'Aluguel de escritório',
}, 'actor-123', 'user-123');
```

---

## 10. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **É possível criar conta a partir de PO:**
   - ✅ `createFromPurchaseOrder()` cria conta quando PO é RECEIVED
   - ✅ Cálculo automático de valor proporcional

2. **É possível criar conta manual:**
   - ✅ `createManualPayable()` cria conta manual

3. **É possível agendar pagamento:**
   - ✅ `schedulePayment()` cria scheduled_action
   - ✅ Vincula scheduled_action_id na conta

4. **Não executar pagamento automaticamente:**
   - ✅ Pagamento só ocorre quando scheduled_action executa
   - ✅ Nenhum pagamento automático

5. **Não criar PaymentIntent automaticamente:**
   - ✅ Nenhum PaymentIntent criado
   - ✅ Futuro: será criado quando scheduled_action executar

6. **Não emitir fiscal:**
   - ✅ Nenhuma emissão fiscal
   - ✅ Nenhuma criação de FiscalDocument

7. **Tudo auditável:**
   - ✅ Todas as mudanças geram audit event
   - ✅ Contexto completo registrado

---

## 11. PRÓXIMOS PASSOS (FUTURO)

### 11.1. Execução Real de Pagamento (Futuro)

**Quando scheduled_action executa:**
1. Criar `PaymentIntent` para o fornecedor
2. Executar pagamento via `PaymentExecutionService`
3. Marcar payable como pago
4. Registrar auditoria completa

**Exemplo futuro:**
```typescript
// No scheduled-action.service.ts executePayment():
if (action.referenceType === 'accounts_payable') {
  const payable = await accountsPayableService.getPayableById(tenantId, action.referenceId);
  
  // 1. Criar PaymentIntent
  const paymentIntent = await paymentIntentService.createIntent(tenantId, {
    orderId: null, // Não há order no marketplace
    buyerActorId: companyActorId, // Actor da empresa
    sellerActorId: payable.supplierId,
    amount: payable.amountCents / 100,
    currency: payable.currency,
    metadata: {
      accounts_payable_id: payable.id,
      reference_type: payable.referenceType,
      reference_id: payable.referenceId,
    },
  });

  // 2. Autorizar intent
  await paymentIntentService.authorizeIntent(tenantId, paymentIntent.id, {
    authorizedByActorId: action.createdByActorId,
  });

  // 3. Executar pagamento
  await paymentExecutionService.executePayment(tenantId, {
    paymentIntentId: paymentIntent.id,
    buyerActorId: companyActorId,
    sellerActorId: payable.supplierId,
    actingUserId: action.createdByUserId,
  });

  // 4. Marcar payable como pago
  await accountsPayableService.markAsPaid(
    tenantId,
    payable.id,
    action.createdByActorId,
    action.createdByUserId
  );
}
```

### 11.2. Relatórios (Futuro)

- Relatório de contas a pagar por fornecedor
- Relatório de contas vencidas
- Relatório de contas agendadas
- Relatório de pagamentos realizados

### 11.3. Notificações (Futuro)

- Notificar quando conta está próxima do vencimento
- Notificar quando conta vence
- Notificar quando pagamento é agendado

---

**Fim do Relatório**




