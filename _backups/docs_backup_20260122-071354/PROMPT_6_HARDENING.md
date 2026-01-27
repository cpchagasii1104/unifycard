# PROMPT 6 - HARDENING FINAL: Testes + Idempotência

## CONTEXTO
Sistema Unificard com checkout de eventos implementado. Split de 70% para organizador funcionando via `created_by_company_id` ou `created_by_global_user_id`. Faltam testes automatizados e idempotência para garantir segurança financeira.

---

## TAREFA 1: Criar Teste de Integração do Split EVENT

**Arquivo:** `backend/tests/integration/event-checkout-split.test.ts`

**Casos de teste obrigatórios:**

```typescript
describe('Event Checkout Split', () => {
  
  describe('EVENT_TICKET', () => {
    test('70% vai para conta da empresa quando created_by_company_id existe', async () => {
      // 1. Criar empresa com conta merchant
      // 2. Criar evento com created_by_company_id = empresa
      // 3. Criar usuário comprador com saldo
      // 4. Executar checkout via TicketService.purchaseTicket()
      // 5. Validar ledger_entries:
      //    - 70% creditado na conta merchant da empresa
      //    - 15% creditado na conta do tenant
      //    - 10% creditado na conta da região
      //    - 5% creditado na conta do grupo (se existir)
    });

    test('70% vai para conta do usuário criador quando created_by_company_id é NULL', async () => {
      // 1. Criar evento SEM created_by_company_id (só created_by_global_user_id)
      // 2. Executar checkout
      // 3. Validar: 70% na conta do usuário criador
    });

    test('Checkout falha se evento não existe', async () => {
      // Tentar checkout com eventId inexistente
      // Esperar erro "Event not found"
    });
  });

  describe('EVENT_CONSUMPTION', () => {
    test('70% vai para organizador em consumo', async () => {
      // Similar ao ticket, mas via ConsumptionService.registerConsumption()
    });

    test('Múltiplos itens geram split único consolidado', async () => {
      // Consumo com 3 itens
      // Validar que split é sobre o total, não item a item
    });
  });

  describe('Atomicidade', () => {
    test('Falha no split reverte ticket para PENDING', async () => {
      // Simular falha no SplitEngine
      // Validar que ticket não fica ACTIVE
    });
  });
});
```

**Setup necessário no beforeAll:**
- Criar tenant de teste
- Criar global_users de teste
- Criar empresa de teste
- Criar contas (merchant, user, region)
- Criar evento de teste

**Cleanup no afterAll:**
- Deletar todos os dados de teste (ordem: transactions → ledger → accounts → tickets → events → users → tenant)

---

## TAREFA 2: Implementar Idempotência no Checkout

### 2.1 Migration 072

**Arquivo:** `backend/migrations/072_checkout_idempotency.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 072
-- Checkout Idempotency
-- Previne duplicação de tickets/consumptions em retry
-- ================================================

-- Adicionar idempotency_key em tickets
ALTER TABLE event_tickets 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_idempotency 
  ON event_tickets(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Adicionar idempotency_key em consumptions
ALTER TABLE event_consumptions 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consumptions_idempotency 
  ON event_consumptions(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Índice para created_by_company_id (performance do EventOrganizerResolver)
CREATE INDEX IF NOT EXISTS idx_events_created_by_company 
  ON events(created_by_company_id) 
  WHERE created_by_company_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN event_tickets.idempotency_key IS 'Chave única para prevenir tickets duplicados em retry';
COMMENT ON COLUMN event_consumptions.idempotency_key IS 'Chave única para prevenir consumos duplicados em retry';
```

### 2.2 Atualizar Tipos do Checkout

**Arquivo:** `backend/src/core/checkout/types/unifycard-checkout.types.ts`

Adicionar campo `idempotencyKey`:

```typescript
export interface CheckoutContext {
  module: 'EVENT_TICKET' | 'EVENT_CONSUMPTION';
  eventId: string;
  eventType: string;
  cityId: string;
  globalUserId: string;
  idempotencyKey?: string; // NOVO: Chave para prevenir duplicação

  // Opcionais existentes
  ticketId?: string;
  consumptionIds?: string[];
  scheduleSlotId?: string;
}
```

### 2.3 Atualizar TicketService

**Arquivo:** `backend/src/services/events/TicketService.ts`

Modificar `purchaseTicket()`:

```typescript
async purchaseTicket(params: {
  eventId: string;
  buyerUserId: string;
  tenantId: string;
  idempotencyKey?: string; // NOVO
}): Promise<{ ticketId: string; qrCode: string; price: number | null; transactionId?: string }> {
  
  // NOVO: Verificar idempotência ANTES de tudo
  if (params.idempotencyKey) {
    const existing = await runQueryWithTenant<TicketRow>(
      params.tenantId,
      `SELECT * FROM event_tickets 
       WHERE idempotency_key = $1 AND tenant_id = $2
       LIMIT 1`,
      [params.idempotencyKey, params.tenantId]
    );
    
    if (existing) {
      // Retornar ticket existente (idempotente)
      return {
        ticketId: existing.id,
        qrCode: existing.qr_code,
        price: existing.price_paid,
        transactionId: existing.transaction_id || undefined,
      };
    }
  }

  return runTenantTransaction(params.tenantId, async (trx) => {
    // ... código existente ...
    
    // Modificar INSERT para incluir idempotency_key
    const ticketResult = await trx.query({
      text: `
        INSERT INTO event_tickets (
          tenant_id, event_id, global_user_id, schedule_slot_id,
          price_paid, qr_code, status, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      values: [
        params.tenantId,
        params.eventId,
        params.buyerUserId,
        slotId,
        event.ticket_price || 0,
        qrCode,
        'PENDING',
        params.idempotencyKey || null, // NOVO
      ],
    });
    
    // ... resto do código existente ...
  });
}
```

### 2.4 Atualizar ConsumptionService

**Arquivo:** `backend/src/services/events/ConsumptionService.ts`

Similar ao TicketService:
- Adicionar `idempotencyKey` nos parâmetros
- Verificar existência antes de criar
- Incluir no INSERT

### 2.5 Atualizar Rotas de Checkout

**Arquivo:** `backend/src/core/checkout/checkout.routes.ts`

Aceitar `idempotencyKey` no body:

```typescript
fastify.post<{
  Body: {
    eventId: string;
    idempotencyKey?: string; // NOVO
  };
}>('/event-ticket', async (req, reply) => {
  // ...
  const result = await ticketService.purchaseTicket({
    eventId,
    buyerUserId: userId,
    tenantId: req.tenant.id,
    idempotencyKey: req.body.idempotencyKey, // NOVO
  });
  // ...
});
```

### 2.6 Atualizar API do Frontend

**Arquivo:** `frontend/src/api/checkout.ts`

```typescript
export async function checkoutTicket(
  eventId: string, 
  idempotencyKey?: string
): Promise<CheckoutTicketResponse> {
  const response = await apiFetch('/api/checkout/event-ticket', {
    method: 'POST',
    body: JSON.stringify({ eventId, idempotencyKey }),
  });
  return response.json();
}
```

---

## TAREFA 3: Teste de Idempotência

**Adicionar ao arquivo de teste:**

```typescript
describe('Idempotência', () => {
  test('Retry com mesma idempotencyKey retorna ticket existente', async () => {
    const idempotencyKey = `test_${Date.now()}`;
    
    // Primeira chamada - cria ticket
    const result1 = await ticketService.purchaseTicket({
      eventId,
      buyerUserId,
      tenantId,
      idempotencyKey,
    });
    
    // Segunda chamada - deve retornar o mesmo ticket
    const result2 = await ticketService.purchaseTicket({
      eventId,
      buyerUserId,
      tenantId,
      idempotencyKey,
    });
    
    expect(result1.ticketId).toBe(result2.ticketId);
    expect(result1.qrCode).toBe(result2.qrCode);
    
    // Validar que só existe 1 ticket no banco
    const count = await countTickets(tenantId, eventId);
    expect(count).toBe(1);
  });

  test('Chamadas sem idempotencyKey criam tickets separados', async () => {
    const result1 = await ticketService.purchaseTicket({ eventId, buyerUserId, tenantId });
    const result2 = await ticketService.purchaseTicket({ eventId, buyerUserId, tenantId });
    
    expect(result1.ticketId).not.toBe(result2.ticketId);
  });
});
```

---

## VALIDAÇÃO FINAL

Após implementar, rodar:

```bash
cd backend
npm run migrate
npm test -- --testPathPattern="event-checkout-split"
```

Todos os testes devem passar.

---

## O QUE NÃO FAZER

- ❌ NÃO refatorar EventOrganizerResolver
- ❌ NÃO mexer em event_organizers/organizers module
- ❌ NÃO adicionar constraints de organizador (já existe NOT NULL)
- ❌ NÃO mudar arquitetura de split
- ❌ NÃO adicionar campos desnecessários

---

## RESULTADO ESPERADO

Após este prompt:
1. ✅ Testes provam que split funciona corretamente
2. ✅ Retry no checkout não duplica tickets/consumos
3. ✅ Sistema pronto para produção (financeiramente seguro)
