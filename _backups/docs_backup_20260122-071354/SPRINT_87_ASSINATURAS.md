# SPRINT 87 — ASSINATURAS (RECORRÊNCIA AUDITÁVEL, SEM MÁGICA)

## OBJETIVO

Criar assinaturas recorrentes (mensal/semanal/anual) usando Payment Links como "template" de cobrança e ScheduledActions como motor de execução, com:
- Idempotência
- Retry controlado
- Auditoria forte
- Sem marcar pago antes do webhook PIX
- Sem alterar o core econômico (reutiliza PaymentExecution)

---

## 1. MIGRATION

### `232_create_subscriptions.sql`
Tabela `subscriptions` para armazenar assinaturas recorrentes.

**Campos principais:**
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `contact_id` (UUID, FK para contacts)
- `payment_link_id` (UUID, FK para payment_links) — "template" do link
- `amount` (NUMERIC(14,2))
- `currency` (TEXT, default 'BRL')
- `interval` (ENUM: WEEKLY, MONTHLY, YEARLY)
- `interval_count` (INT, default 1)
- `day_of_month` (INT, nullable, 1..28) — para MONTHLY
- `next_run_at` (TIMESTAMP)
- `status` (ENUM: ACTIVE, PAUSED, CANCELLED)
- `max_failures` (INT, default 3)
- `failure_count` (INT, default 0)
- `last_run_at`, `last_success_at`, `last_failure_at` (TIMESTAMP, nullable)
- `last_payment_intent_id` (UUID, nullable)
- `last_error_code`, `last_error_message` (TEXT, nullable)
- `metadata` (JSONB)
- `created_by_actor_id`, `created_by_user_id` (UUID)
- `created_at`, `updated_at` (TIMESTAMP)

**Índices:**
- `(tenant_id, status, next_run_at)` — Para buscar assinaturas vencidas
- `(tenant_id, contact_id)`
- `(tenant_id, payment_link_id)`

**RLS:** Habilitado com política de isolamento por tenant.

---

## 2. SERVICES

### 2.1 `subscription.types.ts`
Define tipos TypeScript:
- `Subscription`
- `SubscriptionInterval` (WEEKLY | MONTHLY | YEARLY)
- `SubscriptionStatus` (ACTIVE | PAUSED | CANCELLED)
- `CreateSubscriptionInput`
- `SubscriptionFilters`

### 2.2 `subscription.repository.ts`
Repository para operações CRUD:
- `createSubscription()`
- `getSubscriptionById()`
- `listSubscriptions()`
- `getDueSubscriptions()` — Busca assinaturas vencidas
- `updateStatus()`
- `updateNextRunAt()`
- `markLastRun()`
- `markSuccess()`
- `markFailure()`
- `pauseIfMaxFailures()`

### 2.3 `subscription.service.ts`
Service principal com lógica de negócio.

**Métodos principais:**

#### `createSubscription()`
- Valida contact existe
- Valida payment_link existe
- Define `next_run_at` (default: agora + 5min)
- Status ACTIVE
- Audit: `SUBSCRIPTION_CREATED`

#### `pauseSubscription()`
- Status → PAUSED
- Audit: `SUBSCRIPTION_PAUSED`

#### `resumeSubscription()`
- Status → ACTIVE
- Recalcula `next_run_at` se estiver no passado
- Audit: `SUBSCRIPTION_RESUMED`

#### `cancelSubscription()`
- Status → CANCELLED
- Audit: `SUBSCRIPTION_CANCELLED`

#### `runDueSubscriptions(limit=50)`
- Busca subscriptions ACTIVE com `next_run_at <= now()`
- Para cada subscription:
  - Chama `createRunAction()` que cria ScheduledAction
    - `actionType = PAYMENT_EXECUTION`
    - `referenceType = 'subscription'`
    - `referenceId = subscription.id`
    - `scheduled_for = now()` (imediato)
    - `metadata` inclui: `subscription_id`, `payment_link_id`, `contact_id`, `amount`
  - Marca `last_run_at`
- Audit: `SUBSCRIPTION_RUN_SCHEDULED` (por subscription)

**IMPORTANTE:** `runDueSubscriptions` NÃO executa PaymentExecution diretamente. Ele só agenda ScheduledAction — tudo explícito e auditável.

#### `executeSubscriptionAction(subscriptionId, idempotencyKey)`
Este método é chamado pelo `ScheduledActionService.executeSingleAction()` quando `referenceType === 'subscription'`.

**Passos:**
1. Revalida subscription ACTIVE e `next_run_at` vencido
2. Cria PaymentIntent via método interno:
   - Cria order temporário (metadata: `is_payment_link`, `source: 'SUBSCRIPTION'`)
   - Cria PaymentIntent com `amount` do subscription (override)
   - Metadata: `{ source: 'SUBSCRIPTION', subscription_id, contact_id, payerContactId }`
   - Autoriza PaymentIntent
3. Executa pagamento via `PaymentExecutionService.executePayment()`
4. Se método PIX: retorna status PENDING e salva `last_payment_intent_id`
5. Se método UNIFYCARD: se SUCCESS imediato, faz `advanceCycleSuccess()`

#### `advanceCycleSuccess(subscriptionId)`
- `failure_count = 0`
- `last_success_at = now()`
- Recalcula `next_run_at` de acordo com `interval`
- Audit: `SUBSCRIPTION_CYCLE_SUCCESS`

#### `advanceCycleFailure(subscriptionId, error)`
- `failure_count += 1`
- `last_failure_at = now()`
- Guarda `last_error_code/message`
- Se `failure_count >= max_failures` → PAUSED (não CANCELLED)
- `next_run_at = now() + backoff` (6h * failure_count)
- Audit: `SUBSCRIPTION_CYCLE_FAILED`
- Cria alerta `AutomationService` (type: `SUBSCRIPTION_PAYMENT_FAILED`)

---

## 3. INTEGRAÇÕES

### 3.1 ScheduledActionService
Modificado `executePayment()` para suportar `referenceType === 'subscription'`:
```typescript
if (action.referenceType === 'subscription') {
  const { subscriptionService } = await import('../subscriptions/subscription.service');
  await subscriptionService.executeSubscriptionAction(tenantId, action.referenceId, idempotencyKey);
  return;
}
```

### 3.2 PIX Webhook
Integração via `PaymentExecutionService.markPixPaymentAsSuccess()`:
- Quando PIX webhook marca SUCCESS, verifica se `payment_intent.metadata.subscription_id` existe
- Se existir, chama `subscriptionService.advanceCycleSuccess(subscription_id)`
- Se PIX marcar FAILED/EXPIRED, chama `advanceCycleFailure()`

**OBS:** Se o payment não tiver `subscription_id`, ignora. Tudo auditável.

### 3.3 PaymentExecutionService
Novo método `markPixPaymentAsSuccess()`:
- Marca transação PIX como SUCCESS
- Verifica `intent.metadata.subscription_id`
- Se existir, chama `subscriptionService.advanceCycleSuccess()`

---

## 4. ENDPOINTS REST

Todas as rotas estão prefixadas com `/subscriptions` e registradas em `marketplace.routes.ts`.

### 4.1 CRUD
- **POST** `/subscriptions` — Cria assinatura
- **GET** `/subscriptions` — Lista assinaturas (filtros: `contactId`, `paymentLinkId`, `status`)
- **GET** `/subscriptions/:id` — Busca assinatura por ID

### 4.2 Controle
- **POST** `/subscriptions/:id/pause` — Pausa assinatura
- **POST** `/subscriptions/:id/resume` — Retoma assinatura
- **POST** `/subscriptions/:id/cancel` — Cancela assinatura

### 4.3 Admin/Internal
- **POST** `/subscriptions/run-due` — Agenda execuções de assinaturas vencidas (admin/internal)

---

## 5. FRONTEND

### 5.1 Páginas

#### `SubscriptionsPage.tsx`
Lista de assinaturas com:
- Filtros por status (ACTIVE, PAUSED, CANCELLED)
- Busca por contato (nome, email, CPF/CNPJ)
- Ações: Pausar, Retomar, Cancelar, Ver detalhes
- Exibe: valor, intervalo, próxima execução, falhas

### 5.2 API Client

#### `api/subscriptions.ts`
Funções para comunicação com backend:
- `listSubscriptions()`
- `getSubscriptionById()`
- `createSubscription()`
- `pauseSubscription()`
- `resumeSubscription()`
- `cancelSubscription()`
- `runDueSubscriptions()`

### 5.3 Rotas

Registradas em `App.tsx`:
- `/subscriptions` → `SubscriptionsPage`

---

## 6. ESTADOS E TRANSIÇÕES

### Estados
- **ACTIVE**: Assinatura ativa, execuções agendadas
- **PAUSED**: Assinatura pausada (manual ou após max_failures)
- **CANCELLED**: Assinatura cancelada (não pode ser retomada)

### Transições
```
ACTIVE → PAUSED (manual ou max_failures)
PAUSED → ACTIVE (resume)
ACTIVE → CANCELLED (cancel)
PAUSED → CANCELLED (cancel)
```

---

## 7. FLUXO PIX (PENDING → SUCCESS VIA WEBHOOK)

1. **Agendamento**: `runDueSubscriptions()` cria ScheduledAction
2. **Execução**: `executeSubscriptionAction()` cria PaymentIntent e executa PIX
3. **PENDING**: Retorna `{ status: 'PENDING' }`, salva `last_payment_intent_id`
4. **Webhook**: PIX webhook marca como SUCCESS
5. **Avanço**: `markPixPaymentAsSuccess()` detecta `subscription_id` e chama `advanceCycleSuccess()`
6. **Próximo ciclo**: `next_run_at` recalculado

---

## 8. BACKOFF/RETRY

- **Backoff**: `6h * failure_count`
- **Max failures**: Default 3
- **Após max_failures**: Status → PAUSED (não CANCELLED)
- **Alerta**: Criado quando pausa após max_failures

---

## 9. AUDITORIA E ALERTAS

### Eventos de Auditoria
- `SUBSCRIPTION_CREATED`
- `SUBSCRIPTION_PAUSED`
- `SUBSCRIPTION_RESUMED`
- `SUBSCRIPTION_CANCELLED`
- `SUBSCRIPTION_RUN_SCHEDULED`
- `SUBSCRIPTION_CYCLE_SUCCESS`
- `SUBSCRIPTION_CYCLE_FAILED`

### Alertas
- `SUBSCRIPTION_PAYMENT_FAILED` — Criado quando pausa após max_failures

---

## 10. GUARDRAILS

✅ **READ/WRITE apenas em entidades de assinatura**
- Não altera PaymentLink ou PaymentIntent diretamente
- Reutiliza PaymentExecutionService

✅ **Tudo auditável**
- Todas as ações registram `created_by_actor_id` e `created_by_user_id`
- Metadata preservado para auditoria

✅ **Sem automação invisível**
- Execução via ScheduledActions (explícito)
- PIX só fecha ciclo após webhook SUCCESS
- Nenhuma ação automática sem trilho

✅ **Idempotência**
- `idempotencyKey` usado em `executeSubscriptionAction()`
- Evita duplicação de execuções

✅ **Multi-tenancy**
- RLS habilitado
- Isolamento por `tenant_id`

---

## 11. CRITÉRIOS DE PRONTO

- ✅ Consigo criar assinatura vinculada a Contact + PaymentLink
- ✅ `runDueSubscriptions` agenda ScheduledActions
- ✅ Execução respeita idempotência
- ✅ PIX só fecha ciclo após webhook SUCCESS
- ✅ Falha pausa após max_failures e gera alerta
- ✅ Nada altera o core econômico (reuso de serviços)
- ✅ Frontend mínimo funcional
- ✅ Documentação completa

---

## 12. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/232_create_subscriptions.sql`
- `backend/src/modules/subscriptions/subscription.types.ts`
- `backend/src/modules/subscriptions/subscription.repository.ts`
- `backend/src/modules/subscriptions/subscription.service.ts`
- `backend/src/modules/subscriptions/subscription.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas)
- `backend/src/modules/automation/scheduled-action.service.ts` (integração)
- `backend/src/modules/marketplace/payment-execution.service.ts` (método `markPixPaymentAsSuccess`)

### Frontend
- `frontend/src/api/subscriptions.ts`
- `frontend/src/pages/SubscriptionsPage.tsx`
- `frontend/src/pages/SubscriptionsPage.css`
- `frontend/src/App.tsx` (rotas)

### Documentação
- `SPRINT_87_ASSINATURAS.md` (este arquivo)

---

## 13. EXEMPLOS CURL

### Criar assinatura
```bash
curl -X POST http://localhost:3000/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "contactId": "uuid",
    "paymentLinkId": "uuid",
    "amount": 99.90,
    "interval": "MONTHLY",
    "dayOfMonth": 15
  }'
```

### Listar assinaturas
```bash
curl http://localhost:3000/subscriptions?status=ACTIVE
```

### Pausar assinatura
```bash
curl -X POST http://localhost:3000/subscriptions/{id}/pause
```

### Executar assinaturas vencidas (admin)
```bash
curl -X POST http://localhost:3000/subscriptions/run-due \
  -d '{"limit": 50}'
```

---

**Status:** ✅ CONCLUÍDO



