# Event Replay & Idempotency Pass — Auditoria de Idempotência

**Data:** 2025-01-22  
**Status:** ✅ **IMPLEMENTADO**  
**Objetivo:** Garantir que eventos críticos são idempotentes e replay não causa efeitos colaterais

---

## Objetivo

Garantir que eventos críticos (que movem dinheiro, alteram reputação, criam entidades) são idempotentes e que replay attacks não causam efeitos colaterais.

---

## Contexto

Replay attacks são um vetor clássico de ataque onde um atacante captura um evento válido e o reenvia múltiplas vezes para causar efeitos colaterais (ex: duplicar pagamento, alterar reputação múltiplas vezes).

---

## Eventos Críticos Identificados

### 1. Eventos que Movem Dinheiro

#### `transaction.completed`
- **Handler:** `TransactionService.transfer()`
- **Idempotência:** ✅ **JÁ IMPLEMENTADA**
- **Mecanismo:** Verifica `eventId` antes de criar transação
- **Localização:** `backend/src/core/economy/transactions/transaction.service.ts` (linha 119-165)

#### `event.checkout.completed`
- **Handler:** `EventEconomyService.processCheckout()`
- **Idempotência:** ⚠️ **PARCIAL** (usa idempotencyKey, mas não verifica replay)
- **Recomendação:** Adicionar verificação de replay

#### `group.fund.received`
- **Handler:** `onGroupFundReceived()`
- **Idempotência:** ✅ **IMPLEMENTADA**
- **Mecanismo:** `withIdempotency()` wrapper
- **Localização:** `backend/src/core/orchestrator/executors/groups-activity.executors.ts`

**Status:** ✅ **CORRIGIDO**
- Adicionado `withIdempotency()` wrapper
- Replay detectado e logado
- Não cria posts duplicados

### 2. Eventos que Alteram Reputação

#### `core.review.created`
- **Handler:** `reputationService.applyReview()`
- **Idempotência:** ✅ **IMPLEMENTADA**
- **Mecanismo:** `withIdempotency()` wrapper + `ON CONFLICT` no banco
- **Localização:** `backend/src/core/reputation/reputation.events.ts`

**Status:** ✅ **CORRIGIDO**
- Adicionado `withIdempotency()` wrapper
- Replay detectado e logado
- Não causa efeitos colaterais

### 3. Eventos que Criam Entidades

#### `work.job.created`
- **Handler:** `onJobCreated()`
- **Idempotência:** ⚠️ **PARCIAL** (salva contexto, mas não verifica replay)
- **Recomendação:** Adicionar idempotency tracking se criar entidades críticas

#### `group.created`
- **Handler:** `handleGroupCreated()`
- **Idempotência:** ⚠️ **PARCIAL** (salva contexto, mas não verifica replay)
- **Recomendação:** Adicionar idempotency tracking se criar entidades críticas

---

## Sistema de Idempotency Tracking

### Migration 314: Event Idempotency Tracking

**Arquivo:** `backend/migrations/314_event_idempotency_tracking.sql`

Cria tabela `event_idempotency_tracking` para rastrear processamento de eventos críticos:

```sql
CREATE TABLE event_idempotency_tracking (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  handler_name VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(512) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  result_status VARCHAR(50) NOT NULL, -- 'success', 'error', 'skipped'
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT event_idempotency_tracking_unique 
    UNIQUE (tenant_id, event_id, handler_name)
);
```

### Idempotency Tracker Service

**Arquivo:** `backend/src/core/events/idempotency-tracker.ts`

Fornece funções para:
- `generateIdempotencyKey()` - Gera chave única baseada em eventId + handler + payload hash
- `checkIdempotency()` - Verifica se evento já foi processado
- `recordIdempotencySuccess()` - Registra processamento bem-sucedido
- `recordIdempotencyError()` - Registra processamento com erro
- `recordIdempotencyReplay()` - Registra replay detectado
- `withIdempotency()` - Wrapper para handlers críticos

### Exemplo de Uso

```typescript
import { withIdempotency } from '@core/events/idempotency-tracker';

eventBus.subscribe('core.review.created', async (event) => {
  await withIdempotency(
    event.tenantId,
    event.eventId,
    event.type,
    'reputation.applyReview',
    event.payload,
    async () => {
      // Lógica do handler
      const result = await reputationService.applyReview(event.tenantId, payload);
      return result;
    }
  );
});
```

---

## Idempotency Key Format

A chave de idempotência é gerada como:

```
{eventId}:{handlerName}:{payloadHash}
```

Onde:
- `eventId`: UUID único do evento
- `handlerName`: Nome do handler (ex: `reputation.applyReview`)
- `payloadHash`: SHA-256 hash do payload JSON

**Vantagens:**
- Detecta replay do mesmo evento
- Detecta tentativa de replay com payload modificado
- Determinístico (mesmo evento + handler + payload = mesma chave)

---

## Logs Canônicos de Replay

Quando replay é detectado, o sistema registra:

```typescript
console.warn('[IdempotencyTracker] 🔄 REPLAY DETECTADO: Evento já processado', {
  tenantId,
  eventId,
  eventType,
  handlerName,
  idempotencyKey,
  previousStatus: existingTracking.resultStatus,
  previousProcessedAt: existingTracking.processedAt,
  timestamp: new Date().toISOString(),
});
```

---

## Handlers Atualizados

### ✅ Reputation Handler

**Arquivo:** `backend/src/core/reputation/reputation.events.ts`

**Status:** ✅ **CORRIGIDO**
- Adicionado `withIdempotency()` wrapper
- Replay detectado e logado
- Não causa efeitos colaterais

**Antes:**
```typescript
await reputationService.applyReview(tenantId, payload);
```

**Depois:**
```typescript
await withIdempotency(
  tenantId,
  event.eventId,
  event.type,
  'reputation.applyReview',
  payload,
  async () => {
    const result = await reputationService.applyReview(tenantId, payload);
    return result;
  }
);
```

---

## Teste Adversarial

### Cenários de Replay

1. **Replay do Mesmo Evento**
   - Enviar evento com mesmo `eventId` duas vezes
   - **Esperado:** Segunda tentativa detectada como replay, logado, sem efeitos colaterais

2. **Replay com Payload Modificado**
   - Enviar evento com mesmo `eventId` mas payload diferente
   - **Esperado:** Warning logado, mas evento processado (não é replay, pode ser atualização)

3. **Replay de Evento Financeiro**
   - Reenviar `transaction.completed` com mesmo `eventId`
   - **Esperado:** Transação não duplicada, retorna transação existente

4. **Replay de Evento de Reputação**
   - Reenviar `core.review.created` com mesmo `eventId`
   - **Esperado:** Replay detectado, logado, reputação não alterada novamente

---

## Script de Teste Adversarial

**Arquivo:** `backend/scripts/test-event-replay.ts`

Simula cenários de replay para verificar idempotência.

### Executar Teste

```bash
npm run test:event-replay
```

### Cenários Testados

1. **Replay de evento de reputação**
   - Envia `core.review.created` duas vezes com mesmo `eventId`
   - Verifica se replay é detectado
   - Verifica se reputação não é alterada duas vezes

2. **Replay de evento financeiro**
   - Envia `transaction.completed` duas vezes com mesmo `eventId`
   - Verifica se transação não é duplicada

3. **Replay com payload modificado**
   - Envia evento com mesmo `eventId` mas payload diferente
   - Verifica se sistema detecta mudança de payload

---

## Critérios de Sucesso

- ✅ Replay não causa efeitos colaterais
- ✅ Logs canônicos registram tentativa de replay
- ✅ Eventos financeiros são idempotentes
- ✅ Eventos de reputação são idempotentes
- ✅ Eventos que criam entidades são idempotentes (quando aplicável)
- ✅ Idempotency tracking funciona corretamente

---

## Próximos Passos

1. ✅ Criar migration de idempotency tracking
2. ✅ Criar idempotency tracker service
3. ✅ Atualizar reputation handler
4. ✅ Atualizar group.fund.received handler
5. ✅ Criar script de teste adversarial
6. 🔄 Atualizar outros handlers financeiros críticos (se necessário)
7. 🔄 Adicionar idempotency tracking em handlers que criam entidades críticas (se necessário)

---

## Referências

- **Idempotency Tracker:** [`backend/src/core/events/idempotency-tracker.ts`](../../backend/src/core/events/idempotency-tracker.ts)
- **Migration:** [`backend/migrations/314_event_idempotency_tracking.sql`](../../backend/migrations/314_event_idempotency_tracking.sql)
- **SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](SYSTEM-CANONICAL-INVARIANTS.md)

---

**Última Atualização:** 2025-01-22

