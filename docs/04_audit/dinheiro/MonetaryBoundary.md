# MAPA MONETÁRIO ARQUITETURAL — CONVERSÕES DE BOUNDARY (MonetaryBoundary)

## Classificação
Uso de valores monetários **no limite entre camadas**:
DB ↔ backend, snake_case ↔ camelCase, numeric/decimal ↔ number.  
Aqui o dinheiro **não é regra**, é **transporte e adaptação**.

---

### 1. backend/src/modules/groups/groups.repository.ts:81
**Trecho:** `profitPercentage: row.profit_percentage ? parseFloat(row.profit_percentage.toString()) : 0`  
**Origem:** DB `numeric/decimal`  
**Destino:** `number` (DTO)  
**Método:** `parseFloat + toString`  
**Observação:** Default `0` pode mascarar ausência de valor real.

---

### 2. backend/src/modules/work/workers/worker.service.ts:37
**Trecho:** `hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : undefined`  
**Origem:** DB  
**Destino:** `number | undefined`  
**Método:** `Number()`  
**Observação:** Ausência vira `undefined` (não zero).

---

### 3. backend/src/modules/work/workers/worker.service.ts:45
**Trecho:** `totalEarnings: row.total_earnings ? Number(row.total_earnings) : 0`  
**Origem:** DB  
**Destino:** `number`  
**Método:** `Number()`  
**Observação:** Aqui ausência vira `0` — padrão diferente do hourlyRate.

---

### 4. backend/src/modules/work/assignments/assignment.service.ts:30
**Trecho:** `agreedRate: row.agreed_rate ? Number(row.agreed_rate) : 0`  
**Origem:** DB  
**Destino:** `number`  
**Método:** `Number()`  
**Observação:** Conversão direta com default.

---

### 5. backend/src/modules/work/applications/application.service.ts:21
**Trecho:** `proposedRate: row.proposed_rate ? Number(row.proposed_rate) : 0`  
**Origem:** DB  
**Destino:** `number`  
**Método:** `Number()`  
**Observação:** Mesmo padrão do agreedRate.

---

### 6. backend/src/modules/social/social-group.repository.ts:27
**Trecho:** `totalReceived = account.balance`  
**Origem:** economy/account  
**Destino:** domínio social  
**Método:** Atribuição direta  
**Observação:** Unidade monetária não explicitada.

---

### 7. backend/src/modules/social/social-group.repository.ts:138
**Trecho:** `totalReceived = account.balance`  
**Origem:** economy/account  
**Destino:** domínio social  
**Método:** Atribuição direta  
**Observação:** Repetição do padrão.

---

### 8. backend/src/modules/social/social-group.repository.ts:264
**Trecho:** `amount: Number(g.amount || 0)`  
**Origem:** SQL `SUM(...)` (string)  
**Destino:** `number`  
**Método:** `Number()`  
**Observação:** Conversão explícita de agregação SQL.

---

### 9. backend/src/modules/cultural/cultural-event.service.ts:200
**Trecho:** `input.ticket_price_cents || null`  
**Origem:** DTO  
**Destino:** DB  
**Método:** Atribuição direta com fallback  
**Observação:** Preserva `null` explicitamente.

---

### 10. backend/src/modules/services/services.repository.ts:159
**Trecho:** `input.priceCents || null`  
**Origem:** DTO  
**Destino:** DB  
**Método:** Atribuição direta com fallback  
**Observação:** Mesmo padrão do ticket_price_cents.

---

### 11. backend/src/modules/work/assignments/assignment.service.ts:313, 322, 369
**Trecho:** `amount: assignment.agreedRate`  
**Origem:** DTO (assignment)  
**Destino:** economy service  
**Método:** Atribuição direta  
**Observação:** Unidade herdada sem conversão explícita.

---

### 12. backend/src/modules/services/service-order.service.ts:859
**Trecho:** `const grossAmountCents = service.priceCents || order.metadata?.amountCents || 0`  
**Origem:** múltiplas fontes  
**Destino:** cálculo de negócio  
**Método:** Cadeia de fallback  
**Observação:** Boundary implícito entre domínio e regra.

---

### 13. backend/src/modules/services/service-order.service.ts:877, 879, 880
**Trecho:**  
`grossAmount: grossAmountCents,  
platformFee: platformFeeCents,  
providerNetAmount: providerNetAmountCents`  
**Origem:** cálculo interno  
**Destino:** DTO de resposta  
**Método:** Atribuição direta  
**Observação:** Mantém valores em centavos.

---

### 14. backend/src/core/events/event.service.ts:66
**Trecho:** `ticketPriceCents: row.ticket_price_cents`  
**Origem:** DB  
**Destino:** DTO  
**Método:** Atribuição direta  
**Observação:** Snake_case → camelCase sem conversão de tipo.

---

### 15. backend/src/modules/events/events-multi-actor.service.ts:61
**Trecho:** `revenueSharePercent: row.revenue_share_percent`  
**Origem:** DB  
**Destino:** DTO  
**Método:** Atribuição direta  
**Observação:** Percentual sem unidade explícita.

---

## TOTAL
**15 ocorrências classificadas como MonetaryBoundary**

---

## Observações gerais

- Conversões usam `Number()`, `parseFloat()` ou atribuição direta.
- Não há padrão único para ausência de valor (`0`, `null`, `undefined`).
- Unidade monetária nem sempre é explícita no boundary.
- Boundary funciona, mas **ainda não é normativo**.

Este documento **não corrige**.  
Ele **expõe onde o dinheiro cruza camadas**.

**FIM DO DOCUMENTO**
