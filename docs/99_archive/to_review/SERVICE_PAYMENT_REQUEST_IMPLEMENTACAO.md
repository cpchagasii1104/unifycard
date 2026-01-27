# Implementação: Domínio de PAGAMENTO (Payment Request / Payment Intent)

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de PAGAMENTO usando dinheiro fictício para testes

---

## 1. DEFINIÇÃO CANÔNICA

### Payment Request NÃO é:
- ❌ Execução automática
- ❌ Cobrança
- ❌ Integração real
- ❌ Split
- ❌ Check-in
- ❌ Decisão sistêmica
- ❌ Dinheiro real
- ❌ Movimentação de saldo

### Payment Request É:
- ✅ Pedido de pagamento
- ✅ Nasce APÓS booking aceito
- ✅ Intenção financeira
- ✅ Dinheiro fictício (FIC)
- ✅ Não existe "pago" ainda
- ✅ Booking e Decision continuam imutáveis

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/140_service_payment_request.sql`):
   - Tabela `service_payment_requests` com relacionamentos obrigatórios:
     - `booking_id` → `service_bookings` (FK com CASCADE)
     - `service_id` → `services` (FK com CASCADE)
     - `payer_actor_id` → `actors` (FK com CASCADE)
     - `receiver_actor_id` → `actors` (FK com CASCADE)
   - Enum: `payment_request_status` (pending, cancelled, expired)
   - Campos: `amount`, `currency` (default: 'FIC'), `requested_at`, `cancelled_at`, `expired_at`
   - Constraint: `amount > 0`
   - Índice UNIQUE: apenas um pedido de pagamento por booking
   - Triggers para `updated_at`, `cancelled_at`, `expired_at`
   - Índices para performance

2. **Tipos** (`src/modules/services/service-payment-request.types.ts`):
   - `PaymentRequestStatus` enum
   - `ServicePaymentRequest` interface
   - `CreateServicePaymentRequestInput` interface
   - `UpdateServicePaymentRequestInput` interface

3. **Repository** (`src/modules/services/service-payment-request.repository.ts`):
   - `findById()` - Busca payment request por ID
   - `findByBookingId()` - Busca payment request por Booking ID
   - `findByService()` - Lista payment requests de um Service
   - `create()` - Cria novo payment request (valida IDs obrigatórios, constraint UNIQUE)
   - `update()` - Atualiza payment request

4. **Service** (`src/modules/services/service-payment-request.service.ts`):
   - `createPaymentRequest()` - Cria payment request com validação:
     - Booking existe
     - Service existe
     - Booking pertence ao service
     - Payer actor existe
     - Receiver actor existe
     - Receiver actor é dono do service
     - Payer actor é requester do booking
     - **REGRAS OBRIGATÓRIA**: Só pode criar payment se existir booking_decision = accepted
   - `getPaymentRequest()` - Busca payment request por ID
   - `getPaymentRequestByBooking()` - Busca payment request por Booking ID
   - `getServicePaymentRequests()` - Lista payment requests de um Service
   - `updatePaymentRequest()` - Atualiza payment request

5. **Routes** (`src/modules/services/service-payment-request.routes.ts`):
   - `POST /services/:serviceId/bookings/:bookingId/payments` - Criar novo payment request
   - `GET /services/:serviceId/bookings/:bookingId/payments` - Buscar payment request de um booking

6. **Module** (`src/modules/services/services.module.ts`):
   - Registrado rotas de payment request

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_PAYMENT_REQUESTED`**:
   - Emitido quando payment request é criado (status = 'pending')
   - Afeta: `PAYMENT_READ_MODEL`, `PAYMENT_LIST_READ_MODEL`, `BOOKING_READ_MODEL`, `SERVICE_READ_MODEL`, `FEED_READ_MODEL`

2. **`SERVICE_PAYMENT_CANCELLED`**:
   - Emitido quando payment request é cancelado (status muda para 'cancelled')
   - Afeta: `PAYMENT_READ_MODEL`, `PAYMENT_LIST_READ_MODEL`, `BOOKING_READ_MODEL`, `SERVICE_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_PAYMENT_REQUESTED]: [
  ReadModelType.PAYMENT_READ_MODEL,
  ReadModelType.PAYMENT_LIST_READ_MODEL,
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
]
[ActorEffect.SERVICE_PAYMENT_CANCELLED]: [
  ReadModelType.PAYMENT_READ_MODEL,
  ReadModelType.PAYMENT_LIST_READ_MODEL,
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`PAYMENT_READ_MODEL`**:
   - Projeção de um payment request individual
   - Atualizado quando: `SERVICE_PAYMENT_REQUESTED`, `SERVICE_PAYMENT_CANCELLED`

2. **`PAYMENT_LIST_READ_MODEL`**:
   - Projeção de lista de payment requests
   - Atualizado quando: `SERVICE_PAYMENT_REQUESTED`, `SERVICE_PAYMENT_CANCELLED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`service-payment-request.types.ts`**:
   - Explica que pagamento nasce APÓS booking aceito
   - Explica que pagamento é um PEDIDO de pagamento, não execução automática
   - Explica que nenhum dinheiro real
   - Explica que nenhum split ainda
   - Explica que nenhuma confirmação automática
   - Explica que Payment Request é intenção financeira
   - Explica que não existe "pago" ainda
   - Explica que nada movimenta saldo
   - Explica que Booking e Decision continuam imutáveis

2. **`service-payment-request.repository.ts`**:
   - Valida que `bookingId`, `serviceId`, `payerActorId` e `receiverActorId` são obrigatórios
   - Comentário: "Nenhum payment deve ser criado sem booking, service, payer e receiver"
   - Comentário: "Só pode criar payment se existir booking_decision = accepted"
   - Comentário: "Apenas um pedido de pagamento por booking (constraint UNIQUE)"
   - Comentário: "Nenhuma query deve usar payment como filtro decisório"

3. **`service-payment-request.service.ts`**:
   - Valida que todos os IDs foram fornecidos
   - Valida que booking existe
   - Valida que service existe
   - Valida que booking pertence ao service
   - Valida que payer actor existe
   - Valida que receiver actor existe
   - Valida que receiver actor é dono do service
   - Valida que payer actor é requester do booking
   - **REGRAS OBRIGATÓRIA**: Valida que booking_decision = accepted existe
   - Comentários explicando que pagamento é um PEDIDO de pagamento, não execução automática
   - Comentários: "Nenhuma execução automática"
   - Comentários: "Nenhuma cobrança"
   - Comentários: "Nenhuma integração real"
   - Comentários: "Nenhum split"
   - Comentários: "Nenhum check-in"
   - Comentários: "Nenhuma decisão sistêmica"

4. **`service-payment-request.routes.ts`**:
   - Comentário: "bookingId, serviceId, payerActorId e receiverActorId são OBRIGATÓRIOS"
   - Comentário: "Só pode criar payment se existir booking_decision = accepted"
   - Comentário: "Pagamento nasce APÓS booking aceito"
   - Comentário: "Apenas um pedido de pagamento por booking (constraint UNIQUE)"

---

## 6. ENDPOINTS

### Backend

1. **`POST /services/:serviceId/bookings/:bookingId/payments`**:
   - Cria novo payment request para um booking
   - Requer: `bookingId` (da URL), `serviceId` (da URL), `payerActorId`, `receiverActorId`, `amount`
   - Opcional: `currency` (default: 'FIC'), `metadata`
   - Valida: booking_decision = accepted existe
   - Valida: apenas um payment request por booking
   - Emite effect: `SERVICE_PAYMENT_REQUESTED`

2. **`GET /services/:serviceId/bookings/:bookingId/payments`**:
   - Busca payment request de um booking
   - Retorna: `ServicePaymentRequest` ou 404 se não encontrado

---

## 7. RELACIONAMENTOS

### Payment ↔ Booking

- **Obrigatório**: `booking_id` (FK para `service_bookings`)
- **Cascade**: `ON DELETE CASCADE` (se booking for deletado, payment é deletado)
- **Constraint UNIQUE**: apenas um payment request por booking
- **Validação**: Booking deve existir antes de criar payment
- **Validação**: Booking deve ter decision = accepted

### Payment ↔ Service

- **Obrigatório**: `service_id` (FK para `services`)
- **Cascade**: `ON DELETE CASCADE` (se service for deletado, payment é deletado)
- **Validação**: Service deve existir antes de criar payment

### Payment ↔ PayerActor

- **Obrigatório**: `payer_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, payment é deletado)
- **Validação**: Payer actor deve existir e ser requester do booking

### Payment ↔ ReceiverActor

- **Obrigatório**: `receiver_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, payment é deletado)
- **Validação**: Receiver actor deve existir e ser dono do service

---

## 8. REGRAS DE NEGÓCIO

### Regra Obrigatória

- ✅ **Só pode criar payment se existir booking_decision = accepted**
  - Validação explícita no service
  - Erro se não existir decisão
  - Erro se decisão não for 'accepted'

### Separação Payment ↔ Booking/Decision

- ✅ Payment Request é intenção financeira
- ✅ Não existe "pago" ainda
- ✅ Nada movimenta saldo
- ✅ Booking e Decision continuam imutáveis
- ✅ Apenas um payment request por booking (constraint UNIQUE)

### Dinheiro Fictício

- ✅ Moeda padrão: 'FIC' (Fictícia)
- ✅ Nenhum dinheiro real
- ✅ Nenhuma integração real
- ✅ Apenas para testes

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/140_service_payment_request.sql`
   - Migration para criar tabela `service_payment_requests`
   - Enum `payment_request_status`
   - Constraint UNIQUE por booking
   - Triggers e índices

2. `src/modules/services/service-payment-request.types.ts`
   - Tipos do domínio de payment request

3. `src/modules/services/service-payment-request.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/services/service-payment-request.service.ts`
   - Service com lógica de negócio

5. `src/modules/services/service-payment-request.routes.ts`
   - Rotas Fastify

### Backend (alterados)

6. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `SERVICE_PAYMENT_REQUESTED`, `SERVICE_PAYMENT_CANCELLED`

7. `src/core/read-models/read-model.types.ts`
   - Adicionado: `PAYMENT_READ_MODEL`, `PAYMENT_LIST_READ_MODEL`

8. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para payment request

9. `src/modules/services/services.module.ts`
   - Registrado rotas de payment request

---

## 11. EXEMPLOS DE USO

### Criar Payment Request

```typescript
POST /services/{serviceId}/bookings/{bookingId}/payments
{
  "payerActorId": "uuid-do-actor-pagador",
  "receiverActorId": "uuid-do-dono-do-service",
  "amount": 100.00,
  "currency": "FIC"
}
```

### Buscar Payment Request de um Booking

```typescript
GET /services/{serviceId}/bookings/{bookingId}/payments
```

---

**Status Final**: ✅ **DOMÍNIO DE PAGAMENTO IMPLEMENTADO E VALIDADO**

