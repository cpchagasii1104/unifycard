# 🧪 TESTES MANUAIS FASE 10 - ESCROW + PENALIDADES

**Data:** 28/12/2025  
**Objetivo:** Validar fluxo completo escrow → evento → split pós-evento → refund

---

## PRÉ-REQUISITOS

1. Migrations executadas:
   ```bash
   npm run migrate
   ```
   - ✅ 092_event_escrow.sql
   - ✅ 093_actor_scores_penalties.sql
   - ✅ 094_event_participants.sql
   - ✅ 095_events_split_processed.sql

2. Servidor backend rodando:
   ```bash
   npm run dev
   ```

3. Autenticação funcionando (token JWT válido)

---

## CENÁRIO A: Evento Pago Feliz

### Passo 1: Criar evento draft

```bash
POST http://localhost:3000/api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_type": "cultural",
  "title": "Show de Teste FASE 10",
  "description": "Teste de fluxo escrow",
  "datetime_start": "2025-12-30T20:00:00Z",
  "datetime_end": "2025-12-30T23:00:00Z",
  "ticket_price_cents": 10000,
  "max_attendees": 50,
  "visibility": "public"
}
```

**Validação:**
- Status code: 201
- Response: `{ id: "...", status: "draft" }`

---

### Passo 2: Publicar evento

```bash
POST http://localhost:3000/api/events/{eventId}/publish
Authorization: Bearer <token>
```

**Validação:**
- Status code: 200
- Response: `{ status: "published" }`
- **CRÍTICO:** Verificar escrow criado:
  ```sql
  SELECT * FROM event_escrow WHERE event_id = '{eventId}';
  ```
  - Deve retornar 1 linha
  - `status` = 'COLLECTING'
  - `total_collected_cents` = 0

---

### Passo 3: Checkout (compra de ingresso)

```bash
POST http://localhost:3000/api/events/{eventId}/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "attendeeActorId": "{actorId}",
  "quantity": 1
}
```

**Validação:**
- Status code: 200
- Response: `{ eventId: "...", attendeeId: "...", transactionId: "..." }`
- **CRÍTICO:** Verificar escrow:
  ```sql
  SELECT total_collected_cents, current_balance_cents, status 
  FROM event_escrow 
  WHERE event_id = '{eventId}';
  ```
  - `total_collected_cents` = 10000 (R$100,00)
  - `current_balance_cents` = 10000
  - `status` = 'COLLECTING'
- **CRÍTICO:** Verificar transação DEPOSIT:
  ```sql
  SELECT * FROM event_escrow_transactions 
  WHERE escrow_id = (SELECT id FROM event_escrow WHERE event_id = '{eventId}')
    AND transaction_type = 'DEPOSIT';
  ```
  - Deve existir 1 transação
  - `amount_cents` = 10000
- **CRÍTICO:** Verificar que NÃO houve split imediato:
  ```sql
  SELECT * FROM ledger 
  WHERE metadata->>'eventId' = '{eventId}' 
    AND entry_type = 'CREDIT'
    AND metadata->>'target' = 'EVENT_ORGANIZER';
  ```
  - Deve retornar 0 linhas (organizador NÃO recebeu ainda)

---

### Passo 4: Simular evento concluído + Split pós-evento

**4.1. Atualizar datetime_end para passado:**
```sql
UPDATE events 
SET datetime_end = now() - INTERVAL '1 hour'
WHERE id = '{eventId}';
```

**4.2. Rodar job manualmente:**

Criar script temporário `test-split.ts`:
```typescript
import { postEventSplitJob } from './src/jobs/post-event-split.job';

const tenantId = 'seu-tenant-id';
const eventId = 'seu-event-id';

postEventSplitJob.execute(tenantId, eventId)
  .then(() => console.log('✅ Split executado'))
  .catch(err => console.error('❌ Erro:', err));
```

Executar:
```bash
npx ts-node test-split.ts
```

**Validação:**
- Escrow status mudou para 'RELEASING' ou 'COMPLETED':
  ```sql
  SELECT status, total_released_cents, current_balance_cents
  FROM event_escrow 
  WHERE event_id = '{eventId}';
  ```
- Transações RELEASE criadas:
  ```sql
  SELECT * FROM event_escrow_transactions 
  WHERE escrow_id = (SELECT id FROM event_escrow WHERE event_id = '{eventId}')
    AND transaction_type = 'RELEASE';
  ```
- Evento marcado como processado:
  ```sql
  SELECT split_processed, split_processed_at 
  FROM events 
  WHERE id = '{eventId}';
  ```
  - `split_processed` = true

---

## CENÁRIO B: Cancelamento com Reembolso Total

### Passo 1: Criar evento publicado com compradores

Seguir Cenário A até Passo 3 (checkout realizado).

### Passo 2: Cancelar evento

```bash
POST http://localhost:3000/api/events/{eventId}/cancel
Authorization: Bearer <token>
```

**Validação:**
- Status code: 200
- Response: `{ status: "cancelled" }`
- **CRÍTICO:** Verificar reembolsos:
  ```sql
  SELECT * FROM event_escrow_transactions 
  WHERE escrow_id = (SELECT id FROM event_escrow WHERE event_id = '{eventId}')
    AND transaction_type = 'REFUND';
  ```
  - Deve existir 1 transação REFUND
  - `amount_cents` = 10000 (valor completo)
- **CRÍTICO:** Verificar escrow:
  ```sql
  SELECT total_refunded_cents, current_balance_cents, status
  FROM event_escrow 
  WHERE event_id = '{eventId}';
  ```
  - `total_refunded_cents` = 10000
  - `current_balance_cents` = 0
  - `status` = 'COMPLETED' ou 'REFUNDING'

---

## CENÁRIO C: No-Show Prestador

### Passo 1: Criar participant

```sql
INSERT INTO event_participants (
  tenant_id, event_id, actor_id, actor_type, role,
  responsibility_level, agreed_amount_cents, expected_headcount,
  status
) VALUES (
  '{tenantId}', '{eventId}', '{participantActorId}', 'page', 'artist',
  1, 5000, 1, 'CONFIRMED'
);
```

### Passo 2: Publicar e fazer checkout

Seguir Cenário A Passos 2-3.

### Passo 3: Simular evento concluído SEM check-in

**3.1. Atualizar datetime_end:**
```sql
UPDATE events 
SET datetime_end = now() - INTERVAL '1 hour'
WHERE id = '{eventId}';
```

**3.2. Rodar split job:**
```bash
npx ts-node test-split.ts
```

**Validação:**
- Participant NÃO recebeu:
  ```sql
  SELECT * FROM event_escrow_transactions 
  WHERE participant_id = '{participantId}'
    AND transaction_type = 'RELEASE';
  ```
  - Deve retornar 0 linhas
- Penalidade aplicada:
  ```sql
  SELECT * FROM actor_penalties 
  WHERE actor_id = '{participantActorId}'
    AND status = 'ACTIVE';
  ```
  - Deve existir penalidade do tipo 'INVITATION_BLOCKED'
- Score reduzido:
  ```sql
  SELECT current_score 
  FROM actor_scores 
  WHERE actor_id = '{participantActorId}';
  ```
  - Score deve ter diminuído (de 80 para 30, por exemplo)

---

## CENÁRIO D: Causador Paga (Responsabilização)

### Passo 1: Criar evento com atração principal e colaboradores

**1.1. Criar atração principal:**
```sql
INSERT INTO event_participants (
  tenant_id, event_id, actor_id, actor_type, role,
  responsibility_level, agreed_amount_cents, expected_headcount,
  status
) VALUES (
  '{tenantId}', '{eventId}', '{mainAttractionActorId}', 'page', 'artist',
  1, 10000, 1, 'CONFIRMED'
);
```

**1.2. Criar colaboradores com check-in:**
```sql
-- Limpeza
INSERT INTO event_participants (
  tenant_id, event_id, actor_id, actor_type, role,
  responsibility_level, agreed_amount_cents, expected_headcount,
  status
) VALUES (
  '{tenantId}', '{eventId}', '{cleaningActorId}', 'page', 'cleaning',
  3, 3000, 2, 'CONFIRMED'
);

-- Check-in da limpeza
INSERT INTO event_check_ins (
  tenant_id, event_id, participant_id, actor_id, actor_type,
  check_in_method
) VALUES (
  '{tenantId}', '{eventId}', '{cleaningParticipantId}', '{cleaningActorId}', 'page',
  'MANUAL'
);
```

### Passo 2: Processar cancelamento por no-show

Criar script `test-responsibility.ts`:
```typescript
import { responsibilityService } from './src/core/events/responsibility.service';

const tenantId = 'seu-tenant-id';
const eventId = 'seu-event-id';

responsibilityService.processEventCancellation(
  tenantId,
  eventId,
  'MAIN_ATTRACTION_NO_SHOW',
  0 // horas antes do evento
)
  .then(() => console.log('✅ Responsabilização processada'))
  .catch(err => console.error('❌ Erro:', err));
```

Executar:
```bash
npx ts-node test-responsibility.ts
```

**Validação:**
- Colaboradores receberam:
  ```sql
  SELECT * FROM event_escrow_transactions 
  WHERE participant_id = '{cleaningParticipantId}'
    AND transaction_type = 'RELEASE';
  ```
  - Deve existir transação RELEASE
  - `amount_cents` = 3000
- Débito criado:
  ```sql
  SELECT * FROM actor_debts 
  WHERE event_id = '{eventId}'
    AND debtor_actor_id = '{mainAttractionActorId}';
  ```
  - Deve existir débito
  - `amount_cents` = 3000 (valor dos colaboradores)
  - `status` = 'PENDING'
  - `guarantor_actor_id` = organizador do evento
- Penalidade aplicada à atração principal:
  ```sql
  SELECT * FROM actor_penalties 
  WHERE actor_id = '{mainAttractionActorId}'
    AND status = 'ACTIVE';
  ```
  - Deve existir penalidade 'NO_SHOW'

---

## VALIDAÇÃO FINAL

### Checklist de Integridade

- [ ] Escrow criado automaticamente na publicação
- [ ] Dinheiro vai para escrow no checkout (não split imediato)
- [ ] Split só acontece pós-evento
- [ ] Cancelamento reembolsa 100%
- [ ] No-show não recebe
- [ ] Causador recebe débito
- [ ] Organizador é garantidor
- [ ] Penalidades aplicadas automaticamente
- [ ] Ledger registra tudo

---

## COMANDOS ÚTEIS

### Verificar estado do escrow:
```sql
SELECT 
  e.id,
  e.event_id,
  e.status,
  e.total_collected_cents,
  e.total_released_cents,
  e.total_refunded_cents,
  e.current_balance_cents
FROM event_escrow e
WHERE e.event_id = '{eventId}';
```

### Ver todas as transações do escrow:
```sql
SELECT 
  t.transaction_type,
  t.amount_cents,
  t.reason,
  t.created_at
FROM event_escrow_transactions t
JOIN event_escrow e ON e.id = t.escrow_id
WHERE e.event_id = '{eventId}'
ORDER BY t.created_at;
```

### Verificar débitos:
```sql
SELECT 
  d.debtor_actor_id,
  d.creditor_actor_id,
  d.amount_cents,
  d.status,
  d.guarantor_actor_id
FROM actor_debts d
WHERE d.event_id = '{eventId}';
```

### Verificar penalidades:
```sql
SELECT 
  p.penalty_type,
  p.reason,
  p.severity,
  p.status,
  p.ends_at
FROM actor_penalties p
WHERE p.actor_id = '{actorId}'
  AND p.status = 'ACTIVE';
```

---

*Documento de testes manuais para FASE 10*














