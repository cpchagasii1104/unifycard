# Implementação: Domínio de EXECUÇÃO DE PAGAMENTO (Dinheiro Fictício + Split)

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de EXECUÇÃO DE PAGAMENTO usando dinheiro fictício, incluindo split de valores

---

## 1. DEFINIÇÃO CANÔNICA

### Payment Execution NÃO é:
- ❌ Automática
- ❌ Integração real
- ❌ Gateway
- ❌ Banco
- ❌ Cobrança externa
- ❌ Lógica "inteligente"
- ❌ Inferência
- ❌ Prioridade
- ❌ Movimentação de saldo real

### Payment Execution É:
- ✅ Execução explícita
- ✅ Registro contábil
- ✅ Dinheiro fictício
- ✅ Split explícito
- ✅ Só pode existir se houver payment_request = pending
- ✅ Apenas uma execução por payment_request
- ✅ Soma dos splits = amount da execution

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/141_service_payment_execution.sql`):
   - Tabela `service_payment_executions` com relacionamentos obrigatórios:
     - `payment_request_id` → `service_payment_requests` (FK com CASCADE)
     - `payer_actor_id` → `actors` (FK com CASCADE)
     - `receiver_actor_id` → `actors` (FK com CASCADE)
   - Campos: `amount`, `currency` (default: 'FIC'), `executed_at`
   - Constraint: `amount > 0`
   - Constraint UNIQUE: apenas uma execução por payment_request
   - Tabela `payment_splits` com relacionamentos obrigatórios:
     - `execution_id` → `service_payment_executions` (FK com CASCADE)
     - `receiver_actor_id` → `actors` (FK com CASCADE)
   - Campos: `amount`, `percentage` (opcional)
   - Constraint: `amount > 0`
   - Constraint: `percentage` entre 0 e 100 (se fornecido)
   - Trigger: valida que soma dos splits = amount da execution
   - Triggers para `updated_at`
   - Índices para performance

2. **Tipos** (`src/modules/services/service-payment-execution.types.ts`):
   - `ServicePaymentExecution` interface
   - `PaymentSplit` interface
   - `CreateServicePaymentExecutionInput` interface
   - `CreatePaymentSplitInput` interface

3. **Repository** (`src/modules/services/service-payment-execution.repository.ts`):
   - `findById()` - Busca execução por ID
   - `findByPaymentRequestId()` - Busca execução por Payment Request ID
   - `findSplitsByExecutionId()` - Lista splits de uma execução
   - `create()` - Cria nova execução (valida IDs obrigatórios, constraint UNIQUE)
   - `createSplit()` - Cria novo split (valida IDs obrigatórios, soma validada por trigger)

4. **Service** (`src/modules/services/service-payment-execution.service.ts`):
   - `createExecution()` - Cria execução com validação:
     - Payment request existe e está pendente
     - Payer actor existe
     - Receiver actor existe
     - Se splits fornecidos: valida que soma dos splits = amount da execution
     - Se splits não fornecidos: cria split único para receiver (100%)
     - Cria splits e valida que cada receiver actor existe
   - `getExecutionByPaymentRequest()` - Busca execução por Payment Request ID

5. **Routes** (`src/modules/services/service-payment-execution.routes.ts`):
   - `POST /payments/:paymentRequestId/execute` - Criar nova execução
   - `GET /payments/:paymentRequestId/execution` - Buscar execução de um payment request

6. **Module** (`src/modules/services/services.module.ts`):
   - Registrado rotas de payment execution com prefix `/payments`

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_PAYMENT_EXECUTED`**:
   - Emitido quando payment é executado
   - Afeta: `PAYMENT_EXECUTION_READ_MODEL`, `PAYMENT_READ_MODEL`, `PAYMENT_LIST_READ_MODEL`, `BOOKING_READ_MODEL`, `SERVICE_READ_MODEL`, `FEED_READ_MODEL`

2. **`SERVICE_PAYMENT_SPLIT_APPLIED`**:
   - Emitido quando split é aplicado (um effect por split)
   - Afeta: `PAYMENT_SPLIT_READ_MODEL`, `PAYMENT_EXECUTION_READ_MODEL`, `PAYMENT_READ_MODEL`, `SERVICE_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_PAYMENT_EXECUTED]: [
  ReadModelType.PAYMENT_EXECUTION_READ_MODEL,
  ReadModelType.PAYMENT_READ_MODEL,
  ReadModelType.PAYMENT_LIST_READ_MODEL,
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
]
[ActorEffect.SERVICE_PAYMENT_SPLIT_APPLIED]: [
  ReadModelType.PAYMENT_SPLIT_READ_MODEL,
  ReadModelType.PAYMENT_EXECUTION_READ_MODEL,
  ReadModelType.PAYMENT_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`PAYMENT_EXECUTION_READ_MODEL`**:
   - Projeção de uma execução de pagamento individual
   - Atualizado quando: `SERVICE_PAYMENT_EXECUTED`, `SERVICE_PAYMENT_SPLIT_APPLIED`

2. **`PAYMENT_SPLIT_READ_MODEL`**:
   - Projeção de um split de pagamento individual
   - Atualizado quando: `SERVICE_PAYMENT_SPLIT_APPLIED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`service-payment-execution.types.ts`**:
   - Explica que execução só pode existir se houver payment_request = pending
   - Explica que execução é explícita, nunca automática
   - Explica que nenhuma integração real
   - Explica que dinheiro é fictício
   - Explica que execução é apenas registro contábil
   - Explica que split é explícito
   - Explica que nada movimenta saldo real
   - Explica que split NÃO pode existir sem execution
   - Explica que soma dos splits = amount da execution
   - Explica que grupos podem receber split
   - Explica que indicação pode receber split

2. **`service-payment-execution.repository.ts`**:
   - Valida que `paymentRequestId` é obrigatório
   - Comentário: "Nenhuma execução deve ser criada sem payment_request = pending"
   - Comentário: "Apenas uma execução por payment_request (constraint UNIQUE)"
   - Comentário: "Split NÃO pode existir sem execution"
   - Comentário: "Soma dos splits = amount da execution (validado por trigger)"

3. **`service-payment-execution.service.ts`**:
   - Valida que payment request existe e está pendente
   - Valida que payer actor existe
   - Valida que receiver actor existe
   - Valida que soma dos splits = amount da execution
   - Comentários explicando que execução é explícita, nunca automática
   - Comentários: "Nenhuma execução automática"
   - Comentários: "Nenhuma lógica 'inteligente'"
   - Comentários: "Nenhuma inferência"
   - Comentários: "Nenhuma prioridade"
   - Comentários: "Nenhuma integração externa"

4. **`service-payment-execution.routes.ts`**:
   - Comentário: "paymentRequestId é OBRIGATÓRIO"
   - Comentário: "Execução só pode existir se houver payment_request = pending"
   - Comentário: "Execução é explícita, nunca automática"
   - Comentário: "Soma dos splits = amount da execution"
   - Comentário: "Apenas uma execução por payment_request (constraint UNIQUE)"

---

## 6. ENDPOINTS

### Backend

1. **`POST /payments/:paymentRequestId/execute`**:
   - Cria nova execução de pagamento
   - Requer: `paymentRequestId` (da URL)
   - Opcional: `splits` (se não fornecido, cria split único para receiver)
   - Valida: payment_request = pending
   - Valida: apenas uma execução por payment_request
   - Valida: soma dos splits = amount da execution
   - Emite effects: `SERVICE_PAYMENT_EXECUTED`, `SERVICE_PAYMENT_SPLIT_APPLIED` (um por split)

2. **`GET /payments/:paymentRequestId/execution`**:
   - Busca execução de um payment request
   - Retorna: `{ execution, splits }` ou 404 se não encontrado

---

## 7. RELACIONAMENTOS

### Execution ↔ PaymentRequest

- **Obrigatório**: `payment_request_id` (FK para `service_payment_requests`)
- **Cascade**: `ON DELETE CASCADE` (se payment request for deletado, execução é deletada)
- **Constraint UNIQUE**: apenas uma execução por payment_request
- **Validação**: Payment request deve existir e estar pendente antes de criar execução

### Execution ↔ PayerActor

- **Obrigatório**: `payer_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, execução é deletada)
- **Validação**: Payer actor deve existir

### Execution ↔ ReceiverActor

- **Obrigatório**: `receiver_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, execução é deletada)
- **Validação**: Receiver actor deve existir

### Split ↔ Execution

- **Obrigatório**: `execution_id` (FK para `service_payment_executions`)
- **Cascade**: `ON DELETE CASCADE` (se execução for deletada, splits são deletados)
- **Validação**: Execution deve existir antes de criar split

### Split ↔ ReceiverActor

- **Obrigatório**: `receiver_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, split é deletado)
- **Validação**: Receiver actor deve existir
- **Suporte**: Grupos podem receber split
- **Suporte**: Indicação pode receber split

---

## 8. REGRAS DE NEGÓCIO

### Regra Obrigatória

- ✅ **Execução só pode existir se houver payment_request = pending**
  - Validação explícita no service
  - Erro se payment request não existir
  - Erro se payment request não estiver pendente

### Regra de Split

- ✅ **Soma dos splits = amount da execution**
  - Validação no service (antes de criar splits)
  - Validação no banco (trigger após INSERT/UPDATE/DELETE)
  - Erro se soma não corresponder

### Split Automático

- ✅ Se splits não fornecidos, cria split único para receiver (100%)
  - Facilita uso quando não há split necessário
  - Mantém consistência com amount da execution

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/141_service_payment_execution.sql`
   - Migration para criar tabelas `service_payment_executions` e `payment_splits`
   - Constraint UNIQUE por payment_request
   - Trigger para validar soma dos splits
   - Triggers e índices

2. `src/modules/services/service-payment-execution.types.ts`
   - Tipos do domínio de execução de pagamento e split

3. `src/modules/services/service-payment-execution.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/services/service-payment-execution.service.ts`
   - Service com lógica de negócio

5. `src/modules/services/service-payment-execution.routes.ts`
   - Rotas Fastify

### Backend (alterados)

6. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `SERVICE_PAYMENT_EXECUTED`, `SERVICE_PAYMENT_SPLIT_APPLIED`

7. `src/core/read-models/read-model.types.ts`
   - Adicionado: `PAYMENT_EXECUTION_READ_MODEL`, `PAYMENT_SPLIT_READ_MODEL`

8. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para execução e split

9. `src/modules/services/services.module.ts`
   - Registrado rotas de payment execution com prefix `/payments`

---

## 11. EXEMPLOS DE USO

### Criar Execução sem Split (Split Automático)

```typescript
POST /payments/{paymentRequestId}/execute
{
  "paymentRequestId": "uuid-do-payment-request"
}
```

### Criar Execução com Split

```typescript
POST /payments/{paymentRequestId}/execute
{
  "paymentRequestId": "uuid-do-payment-request",
  "splits": [
    {
      "receiverActorId": "uuid-do-dono-do-service",
      "amount": 80.00,
      "percentage": 80.0
    },
    {
      "receiverActorId": "uuid-do-grupo",
      "amount": 20.00,
      "percentage": 20.0
    }
  ]
}
```

### Buscar Execução de um Payment Request

```typescript
GET /payments/{paymentRequestId}/execution
```

---

**Status Final**: ✅ **DOMÍNIO DE EXECUÇÃO DE PAGAMENTO IMPLEMENTADO E VALIDADO**

