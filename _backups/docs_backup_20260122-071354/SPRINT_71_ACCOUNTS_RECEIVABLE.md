# SPRINT 71: ACCOUNTS RECEIVABLE (CONTAS A RECEBER)

**Data:** 2024-12-19  
**Objetivo:** Criar núcleo de contas a receber do ERP, integrado com Payment Execution, PDV, Service Orders e Event Tickets, sem executar pagamento.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migration Criada

**Arquivo:**
- `backend/migrations/200_create_accounts_receivable.sql` - Tabela `accounts_receivable`

**Estrutura:**

**accounts_receivable:**
- Status: `PENDING`, `RECEIVED`, `CANCELLED`, `EXPIRED`
- Source Types: `MARKETPLACE_ORDER`, `PDV_ORDER`, `SERVICE_ORDER`, `EVENT_TICKET`
- Campos: actor_id (quem deve receber), source_type, source_id, amount_cents, currency, expected_at, received_at, payment_method (nullable), etc.
- RLS habilitado
- Índices para performance
- Constraint: received_at só pode ser preenchido se status = RECEIVED

### 1.2. Service Criado

**AccountsReceivableService:**
- `createFromPaymentIntent()` - Cria conta a partir de Payment Intent (chamado automaticamente quando payment é SUCCESS)
- `createManualReceivable()` - Cria conta manual
- `markAsReceived()` - Marca conta como recebida
- `cancelReceivable()` - Cancela conta
- `listReceivables()` - Lista contas com filtros
- `getReceivableById()` - Busca conta por ID

### 1.3. Integrações

**createFromPaymentIntent → Payment Execution:**
- Quando payment é SUCCESS, cria conta a receber automaticamente
- `source_type` determinado pela origem do pedido (PDV_ORDER ou MARKETPLACE_ORDER)
- `actor_id` = sellerActorId (quem deve receber)
- `expected_at` = hoje (recebimento imediato por padrão)
- `source_id` = order_id

**Preparação para:**
- Service Orders (estrutura preparada)
- Event Tickets (estrutura preparada)
- Scheduled Actions (estrutura preparada para recebimento automático futuro)

### 1.4. Rotas REST

**Accounts Receivable:**
- `POST /accounts-receivable/manual` - Cria conta manual
- `GET /accounts-receivable` - Lista contas
- `GET /accounts-receivable/:id` - Busca conta
- `POST /accounts-receivable/:id/mark-received` - Marca como recebida
- `POST /accounts-receivable/:id/cancel` - Cancela conta

---

## 2. ESTRUTURA DE DADOS

### 2.1. accounts_receivable

```sql
CREATE TABLE accounts_receivable (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID NOT NULL, -- Quem deve receber (vendedor/prestador)
    source_type accounts_receivable_source_type NOT NULL, -- MARKETPLACE_ORDER | PDV_ORDER | SERVICE_ORDER | EVENT_TICKET
    source_id UUID NOT NULL, -- order_id, payment_intent_id, service_order_id, event_ticket_id
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    status accounts_receivable_status NOT NULL DEFAULT 'PENDING',
    expected_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Data esperada de recebimento
    received_at TIMESTAMP WITH TIME ZONE, -- Data real de recebimento
    payment_method VARCHAR(50), -- CASH, PIX, CREDIT_CARD, etc. (opcional, futuro)
    received_by_actor_id UUID,
    received_by_user_id UUID,
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

## 3. LIFECYCLE DE CONTA A RECEBER

### 3.1. Transições de Status

```
PENDING → RECEIVED
  ↓
CANCELLED
EXPIRED (futuro)
```

**Regras:**
- PENDING: Conta criada, aguardando recebimento
- RECEIVED: Conta recebida
- CANCELLED: Conta cancelada (apenas PENDING)
- EXPIRED: Conta expirada (não recebida dentro do prazo) - futuro

### 3.2. Validações

**Ao Criar:**
- `actor_id` deve existir
- `amount_cents > 0`
- `expected_at` deve ser válida

**Ao Marcar como Recebida:**
- Conta deve estar em PENDING

**Ao Cancelar:**
- Conta deve estar em PENDING

---

## 4. INTEGRAÇÃO COM PAYMENT EXECUTION

### 4.1. Criação Automática

**Quando:** `executePayment()` é chamado e payment é SUCCESS

**O que é criado:**
- Conta a receber com `source_type` determinado pela origem do pedido
- `actor_id` = sellerActorId (quem deve receber)
- `amount_cents` = valor do pagamento
- `expected_at` = hoje (recebimento imediato por padrão)
- `source_id` = order_id

**Exemplo:**
```typescript
// No executePayment(), após sucesso:
await accountsReceivableService.createFromPaymentIntent(tenantId, {
  paymentIntentId,
  actorId: sellerActorId, // Quem deve receber
  sourceType: orderMetadata.pdv_session_id ? 'PDV_ORDER' : 'MARKETPLACE_ORDER',
  sourceId: intent.orderId,
  amountCents: Math.round(intent.amount * 100),
  currency: intent.currency,
  expectedAt: new Date(), // Recebimento imediato
}, sellerActorId, actingUserId);
```

### 4.2. Determinação de Source Type

**Lógica:**
- Se `order.metadata.pdv_session_id` existe → `PDV_ORDER`
- Caso contrário → `MARKETPLACE_ORDER`
- Futuro: `SERVICE_ORDER` e `EVENT_TICKET` serão suportados

---

## 5. GUARDRAILS RESPEITADOS

### 5.1. Accounts Receivable ≠ Payment

- ✅ Accounts Receivable representa direito de recebimento futuro
- ✅ Não executa pagamento
- ✅ Não move dinheiro

### 5.2. Accounts Receivable ≠ Ledger

- ✅ Accounts Receivable é entidade canônica separada
- ✅ Não altera ledger diretamente
- ✅ Ledger é source of truth para movimentações financeiras

### 5.3. Nenhuma Movimentação Financeira

- ✅ Nenhuma movimentação financeira automática
- ✅ Apenas representação de direito de recebimento

### 5.4. Append-Only

- ✅ Status muda, mas registros não desaparecem
- ✅ Histórico completo preservado

### 5.5. Tudo Auditável

- ✅ Todas as mudanças geram audit event
- ✅ Contexto completo registrado
- ✅ Falha de auditoria não bloqueia operação

---

## 6. AUDITORIA

### 6.1. Eventos Registrados

**Accounts Receivable:**
- `ACCOUNTS_RECEIVABLE_CREATED_FROM_PAYMENT` - Quando conta é criada a partir de payment
- `ACCOUNTS_RECEIVABLE_CREATED_MANUAL` - Quando conta é criada manualmente
- `ACCOUNTS_RECEIVABLE_RECEIVED` - Quando conta é marcada como recebida
- `ACCOUNTS_RECEIVABLE_CANCELLED` - Quando conta é cancelada

### 6.2. Contexto de Auditoria

Cada evento inclui:
- `receivable_id`
- `payment_intent_id` (se criada a partir de payment)
- `status`
- `created_by_user_id` / `received_by_user_id` / `cancelled_by_user_id`
- `cancellation_reason` (se cancelada)

---

## 7. ARQUIVOS CRIADOS

### 7.1. Migration

1. `backend/migrations/200_create_accounts_receivable.sql`

### 7.2. Types

2. `backend/src/modules/marketplace/accounts-receivable.types.ts`

### 7.3. Repository

3. `backend/src/modules/marketplace/accounts-receivable.repository.ts`

### 7.4. Service

4. `backend/src/modules/marketplace/accounts-receivable.service.ts`

### 7.5. Routes

5. `backend/src/modules/marketplace/accounts-receivable.routes.ts`

### 7.6. Integrações

6. `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado - cria receivable quando payment é SUCCESS)
7. `backend/src/modules/marketplace/marketplace.routes.ts` (atualizado - registra rotas)

---

## 8. EXEMPLOS DE USO

### 8.1. Fluxo Automático: Payment SUCCESS → Receivable

```typescript
// 1. Payment é executado com sucesso
const transaction = await paymentExecutionService.executePayment(tenantId, {
  paymentIntentId: 'intent-123',
  buyerActorId: 'buyer-123',
  sellerActorId: 'seller-123',
  actingUserId: 'user-123',
});

// 2. Conta a receber é criada automaticamente
// (dentro do executePayment, após SUCCESS)

// 3. Buscar conta criada
const receivables = await accountsReceivableService.listReceivables(tenantId, {
  sourceType: 'MARKETPLACE_ORDER',
  sourceId: orderId,
});
const receivable = receivables[0]; // Conta criada automaticamente

// 4. Marcar como recebida (quando dinheiro realmente chega)
const receivedReceivable = await accountsReceivableService.markAsReceived(
  tenantId,
  receivable.id,
  'actor-123',
  'user-123'
);
```

### 8.2. Criar Conta Manual

```typescript
// Criar conta manual
const receivable = await accountsReceivableService.createManualReceivable(tenantId, {
  actorId: 'seller-123',
  sourceType: 'SERVICE_ORDER',
  sourceId: 'service-order-123',
  amountCents: 100000, // R$ 1.000,00
  currency: 'BRL',
  expectedAt: new Date('2024-12-31'),
  paymentMethod: 'PIX',
  description: 'Serviço de consultoria',
}, 'actor-123', 'user-123');
```

---

## 9. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **É possível criar conta a partir de Payment Intent:**
   - ✅ `createFromPaymentIntent()` cria conta quando payment é SUCCESS
   - ✅ Source type determinado automaticamente

2. **É possível criar conta manual:**
   - ✅ `createManualReceivable()` cria conta manual

3. **É possível marcar como recebida:**
   - ✅ `markAsReceived()` marca conta como recebida

4. **É possível cancelar:**
   - ✅ `cancelReceivable()` cancela conta

5. **Não executar pagamento:**
   - ✅ Nenhum pagamento executado
   - ✅ Apenas representação de direito de recebimento

6. **Accounts Receivable ≠ Payment:**
   - ✅ Accounts Receivable é entidade separada
   - ✅ Não executa pagamento

7. **Accounts Receivable ≠ Ledger:**
   - ✅ Accounts Receivable não altera ledger
   - ✅ Ledger é source of truth

8. **Tudo auditável:**
   - ✅ Todas as mudanças geram audit event
   - ✅ Contexto completo registrado

---

## 10. PRÓXIMOS PASSOS (FUTURO)

### 10.1. Integração com Service Orders (Futuro)

**Quando:** Service Order é completada

**O que criar:**
- Conta a receber com `source_type = 'SERVICE_ORDER'`
- `source_id` = service_order_id
- `expected_at` = data de conclusão do serviço

### 10.2. Integração com Event Tickets (Futuro)

**Quando:** Event Ticket é vendido

**O que criar:**
- Conta a receber com `source_type = 'EVENT_TICKET'`
- `source_id` = event_ticket_id
- `expected_at` = data do evento

### 10.3. Scheduled Actions para Recebimento Automático (Futuro)

**Quando:** Conta a receber atinge `expected_at`

**O que fazer:**
- Criar scheduled_action para marcar como recebida automaticamente
- Ou criar alerta para usuário

### 10.4. Expiração Automática (Futuro)

**Quando:** Conta a receber não é recebida dentro do prazo

**O que fazer:**
- Marcar como EXPIRED automaticamente
- Criar alerta para usuário

### 10.5. Payment Methods (Futuro)

**Quando:** Payment method é definido

**O que fazer:**
- Atualizar `payment_method` na conta
- Calcular `expected_at` baseado no método (ex: D+0 para PIX, D+30 para crédito)

---

**Fim do Relatório**




