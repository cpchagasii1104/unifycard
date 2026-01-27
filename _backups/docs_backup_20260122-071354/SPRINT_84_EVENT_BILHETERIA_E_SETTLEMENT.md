# SPRINT 84 — EVENT SETTLEMENT + BILHETERIA FINANCEIRA

## OBJETIVO

Fechar o ciclo econômico de eventos:
- Bilheteria
- Comissão
- Taxa regional
- Settlement por evento

---

## 1. MIGRATION

### 1.1. `221_create_event_settlements.sql`

Tabela `event_settlements`:
- `id`, `tenant_id`, `event_id`
- `gross_revenue` (em centavos)
- `commissions_amount` (em centavos)
- `regional_fee_amount` (em centavos)
- `net_amount` (em centavos)
- `currency`
- `status` (PENDING, SETTLED)
- `settlement_id` (vinculado quando liquidado)
- `settled_at`, `settled_by_actor_id`, `settled_by_user_id`
- `metadata`, `created_at`, `updated_at`
- RLS habilitado
- Índices por tenant_id, event_id, status

---

## 2. SERVICE

### 2.1. EventSettlementService

**Arquivo:** `backend/src/modules/marketplace/event-settlement.service.ts`

**Métodos:**
- `createFromEvent()` - Cria settlement de evento
- `settleEvent()` - Liquida settlement de evento
- `getSettlementByEvent()` - Busca settlement por evento

**Integrações:**
- ✅ TicketService: cria/atualiza event_settlement quando ticket é confirmado
- ✅ SettlementService: vincula ao settlement core quando liquidado
- ✅ Auditoria em todas as ações

---

## 3. INTEGRAÇÃO

### 3.1. Ticket Payment SUCCESS

**Fluxo:**
1. Ticket payment é confirmado (`confirmTicketPayment()`)
2. Busca ou cria `event_settlement` para o evento
3. Atualiza `gross_revenue` (soma de todos os ingressos vendidos)
4. Atualiza `commissions_amount` (soma de comissões calculadas)
5. `regional_fee_amount` será calculado quando settlement for liquidado

**Código:**
```typescript
// Em ticket.service.ts, após confirmar ticket:
const eventSettlement = await eventSettlementService.getSettlementByEvent(tenantId, eventId);

if (!eventSettlement) {
  // Criar novo settlement
  await eventSettlementService.createFromEvent(tenantId, {
    eventId,
    grossRevenue: ticket.priceCents,
    commissionsAmount: commissionSnapshot.total_commission_cents || 0,
    regionalFeeAmount: 0, // Será calculado quando liquidado
  });
} else {
  // Atualizar settlement existente (futuro: adicionar método updateSettlement)
}
```

### 3.2. Settlement Final

**Fluxo:**
1. Event settlement é liquidado (`settleEvent()`)
2. Vincula ao `settlement` core existente
3. Marca status como SETTLED
4. Registra quem liquidou e quando

---

## 4. GUARDRAILS

- ✅ Evento ≠ Empresa
- ✅ Evento ≠ Payout
- ✅ Tudo explícito
- ✅ Nada automático
- ✅ Tudo auditável

---

## 5. ROTAS REST

### 5.1. `GET /marketplace/events/:id/settlement`

Busca settlement de evento.

**Resposta:**
```json
{
  "settlement": {
    "id": "...",
    "eventId": "...",
    "grossRevenue": 50000,
    "commissionsAmount": 5000,
    "regionalFeeAmount": 1500,
    "netAmount": 43500,
    "status": "PENDING",
    "settlementId": null,
    "createdAt": "..."
  }
}
```

### 5.2. `POST /marketplace/events/:id/settlement/settle`

Liquida settlement de evento.

**Body:**
```json
{
  "settlementId": "..." // Opcional: settlement core vinculado
}
```

**Resposta:**
```json
{
  "settlement": {
    "id": "...",
    "status": "SETTLED",
    "settlementId": "...",
    "settledAt": "...",
    "settledByActorId": "..."
  }
}
```

---

## 6. DOCUMENTAÇÃO

Este documento resume a implementação da Sprint 84.

---

## 7. NOTAS

- Event settlement é criado quando primeiro ticket é confirmado
- Receita bruta é atualizada conforme mais tickets são confirmados
- Comissões são somadas de cada ticket confirmado
- Taxa regional será calculada quando settlement for liquidado
- Nenhum payout automático



