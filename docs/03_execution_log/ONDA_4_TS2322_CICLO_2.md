# ONDA 4 — TS2322/TS2345 (Ciclo 2 — Type mismatch remanescente)

**Data:** 2026-02-25  
**Modo:** EXECUTOR  
**Âncora:** `docs/03_execution_log/ONDA_4_TS2322_CICLO_1.md`  
**Baseline histórico:** 209 ocorrências (TS2322+TS2345)  
**Meta global:** ≤ 80  
**Meta do ciclo:** Reduzir ≥ 50% dos remanescentes

---

## PASSO 1 — Contagem real

### Antes do Ciclo 2 (após Ciclo 1)

| Código | Qtde |
|--------|------|
| TS2322 | 99   |
| TS2345 | 16   |
| **Total** | **115** |

### Depois do Ciclo 2

| Código | Qtde |
|--------|------|
| TS2322 | 56   |
| TS2345 | 15   |
| **Total** | **71** |

### Por domínio (remanescentes após Ciclo 2)

| Domínio | Qtde (aprox.) |
|---------|----------------|
| core (events, economy) | 2 |
| modules/bank | 1 |
| modules/care | 1 |
| modules/crm | 3 |
| modules/events | 12+ |
| modules/human-mvp | 0 |
| modules/marketplace (routes, service) | 25+ |
| modules/pdv, my-orders, public-profiles, risk-command-center, services, social, venue, work-instant, services/ | restante |

---

## PASSO 2 — Classificação dos remanescentes

| Arquivo | Erro | Categoria | Correção proposta |
|---------|------|-----------|-------------------|
| event-payment-prepared.service.ts | row \| undefined → PaymentAuthorizationRow | Nullability / narrowing | assertDefined ou guard + variável (já aplicado assertDefined) |
| bank-reconciliation-history.repository.ts | string → Date | DTO / Date vs string | Converter string para Date ou ajustar tipo de retorno |
| care.service.ts | string \| undefined → string | Nullability | Guard primaryIntent.intent != null (aplicado) |
| crm.service.ts, event-feed, organizer-billing, risk-dashboard, service-feed | string ↔ Date | Date vs string | Mapper toISOString() ou tipo consistente |
| event-rfq.service.ts | Date → string | Date vs string | toISOString() em retornos |
| events-multi-actor.service.ts | string \| undefined → string | Nullability | Default ou guard |
| events.service.ts | EventStatus / joinedAt string vs Date | Union / DTO | Alinhar tipo EventStatus e joinedAt |
| ticket.service.ts | string → PaymentCurrency | Union | Cast seguro ou tipo literal |
| marketplace.routes.ts (vários) | snake_case body → camelCase service | DTO incompleto | Mapper body → input do service (store_id → storeId, etc.) |
| marketplace.service.ts | truck, own, quote_required, utilization_rate, etc. | Union / DTO shape | Estender tipos ou mapear valores |
| marketplace-public.routes, marketplace-search | string \| undefined → string | Nullability | Guard ou default |
| store-product.service.ts | string \| null \| undefined → string \| null | Nullability | ?? null |
| my-orders.service.ts | Date → string | Date vs string | toISOString() |
| pdv.service.ts | string → PaymentCurrency | Union | Ajustar tipo ou valor |
| public-profile.repository.ts | PublicProfile \| null → PublicProfile | Nullability | Guard antes de retorno |
| services.service.ts | "service" / "active" → AvailabilityOwnerType / UnifiedAvailabilityStatus | Enum | Mapear para valores canônicos do tipo |
| social adapters, venue tab, SlotGenerator, etc. | Vários | Nullability / Date / union | Tratamento por caso |

---

## PASSO 3 — Estratégia aplicada (Ciclo 2)

### Nullability residual
- **account.routes:** `CreateAccountInput` com `currency` obrigatório → passado `parsed.data.currency ?? 'BRL'` e objeto explícito (ownerId, ownerType, currency).
- **event-payment-prepared:** Uso de `assertDefined(row)` para narrow `row` antes de `toAuthorization(row)`.
- **care.service:** `content: input.text ?? ''`, `conversationId: session.careSessionId ?? ''`, e guard `primaryIntent.intent != null` antes de atribuir a `detectedIntent`.
- **payment-execution:** `actingUserId: intent.metadata?.actingUserId ?? ... ?? 'system'`; removido `pixChargeId` do `recordAudit` (não faz parte da assinatura).
- **bank-limit, payment-execution, payout:** `company_id`/`employee_id`: `null` → `undefined`; severidade em lowercase.

### Audit (AuditSource / AuditSeverity)
- **audit.service:** Estendidos `AuditSeverity` com `'info'` e `AuditSource` com: `events`, `marketplace_payment`, `marketplace_payout`, `region_accounts`, `settlements`, `tax_profile`, `unifycard_method`, `unifycard`, `organization`, `pdv`, `public_profiles`.
- **checkin, event.service (modules/events), ticket.service:** `severity: 'MEDIUM'` → `'medium'`; `actor_id` com `?? null`.

### CategoryContext (person → lifestyle)
- **human-mvp:** Em activity-execution, event-instance, matching, opportunity e routes: mapeamento `context === 'person' ? 'lifestyle' : context` e uso de `categoryContext` (canônico) em `allowedContexts` e em chamadas a `hasWriteAccess` / `getCategoriesForTenant` / `publishOpportunity`.

### Outros
- **social-work-payment.service:** Inclusão de `eventId: uuidv4()` na chamada a `transactionService.transfer`.
- **event-payment-prepared:** `if (row === undefined) throw` mantido; adicionado `assertDefined(row)` para narrowing.

Nenhum `as any`, `as unknown`, strict desligado ou contrato público alterado.

---

## PASSO 4 — Validação

- **TS2322 antes (Ciclo 2):** 99  
- **TS2322 depois:** 56  
- **TS2345 antes (Ciclo 2):** 16  
- **TS2345 depois:** 15  
- **Total antes (Ciclo 2):** 115  
- **Total depois:** 71  
- **Redução absoluta:** 44  
- **Redução percentual:** 38,3% (meta do ciclo era ≥ 50%)  
- **Meta global (≤ 80):** 71 ≤ 80 ✓

---

## Arquivos modificados (Ciclo 2)

- `backend/src/core/audit/audit.service.ts` — AuditSeverity + 'info'; AuditSource estendido com 11 fontes.
- `backend/src/core/economy/accounts/account.routes.ts` — CreateAccountInput com currency obrigatório (currency ?? 'BRL').
- `backend/src/core/events/event-payment-prepared.service.ts` — assertDefined(row) para narrowing.
- `backend/src/modules/bank/bank-limit.service.ts` — severity 'medium', company_id undefined.
- `backend/src/modules/marketplace/payment-execution.service.ts` — severity lowercase; company_id/employee_id undefined; actingUserId string; removido pixChargeId de recordAudit.
- `backend/src/modules/marketplace/payout.service.ts` — severity lowercase; company_id/employee_id undefined.
- `backend/src/modules/human-mvp/human-mvp-activity-execution.service.ts` — person → lifestyle, allowedContexts canônicos.
- `backend/src/modules/human-mvp/human-mvp-event-instance.service.ts` — (já com categoryContext/lifestyle).
- `backend/src/modules/human-mvp/human-mvp-matching.service.ts` — categoryContext e allowedContexts canônicos.
- `backend/src/modules/human-mvp/human-mvp-opportunity.service.ts` — categoryContext e allowedContexts canônicos.
- `backend/src/modules/human-mvp/human-mvp.routes.ts` — categoryContext na publicação de opportunity.
- `backend/src/modules/events/checkin.service.ts` — severity 'medium', actor_id com ??.
- `backend/src/modules/events/event.service.ts` — severity 'medium', actor_id com ??.
- `backend/src/modules/events/ticket.service.ts` — severity 'medium', actor_id com ??.
- `backend/src/modules/social/social-work-payment.service.ts` — eventId na transfer.
- `backend/src/modules/care/care.service.ts` — content/conversationId com ?? ''; guard primaryIntent.intent != null.

---

## Resultado do tsc

Comando:

```bash
cd backend && pnpm exec tsc --noEmit --pretty false
```

- Total de erros (todos os códigos): a confirmar com saída completa.
- TS2322+TS2345: **71** (confirmado em `ts_ciclo2_after.txt`).

---

## Observações

- Meta do ciclo (≥ 50% de redução dos 115) não foi atingida (38,3%); meta global ≤ 80 foi atingida (71).
- Remanescentes concentram-se em: **marketplace** (rotas com body em snake_case vs service em camelCase), **Date vs string** em vários módulos, **union/enum** (EventStatus, PaymentCurrency, AvailabilityOwnerType, etc.) e **nullability** pontual. Ciclo 3 pode atacar mappers snake_case→camelCase no marketplace e alinhamento Date/string.
- Proxies fail-fast (Promise.reject) não foram alterados neste ciclo; tipos de retorno desses proxies podem ser tratados em ciclo futuro se necessário.
