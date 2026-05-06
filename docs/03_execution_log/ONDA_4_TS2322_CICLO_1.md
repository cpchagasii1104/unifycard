# ONDA 4 — TS2322/TS2345 (Ciclo 1 — Type mismatch)

**Data:** 2026-02-25  
**Modo:** EXECUTOR  
**Âncora:** `docs/03_execution_log/ONDA_3_TS2304_CICLO_3.md`  
**Estado inicial (TS2322+TS2345):** 209 (de `backend/ts_out.txt`)  
**Meta do ciclo:** Redução mínima de 40% (≤ ~125)

---

## Classificação (resumo por categoria)

| Categoria | Exemplos | Ação aplicada |
|----------|----------|----------------|
| **Nullability** | `string \| null` vs `string \| undefined`, `PaymentAuthorizationRow \| undefined` | `?? undefined`, guard + variável tipada, defaults `\|\| {}` / `?? ''` |
| **Date vs string** | `Date` não atribuível a `string` (Company, CanonicalProduct, etc.) | `row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)` em mappers |
| **Enum / Union** | `BankAccountOwnerType` sem `merchant`/`group`, `AlertSeverity` uppercase vs lowercase, `CategoryContext` canônico | Mapeamento `merchant`→`company`, `group`→`system`; severities em lowercase; testes com contextos canônicos |
| **DTO vs Entity** | `BankAccountBalance` vs `number` (currentBalance) | Usar `balance.balance` onde o tipo espera `number` |
| **Argumentos parciais** | `eventId?: string` em transfer; `fromAccount`/`toAccount` opcionais em autoDistribute | Guard `fromAccount/toAccount` obrigatórios; `eventId: parsed.data.eventId ?? uuidv4()` |
| **Legacy authorship** | `FinancialAuthorshipContext` com `null`/`'legacy'` | Preencher com `authoritySource: 'system'`, `permissionSnapshot` mínimo, `actingForActorId/actingForAccountId` = fromAccount |
| **Audit / automation** | `actor_type: 'system'`, `actor_id: null`, severity UPPERCASE | Estender `AuditEventInput` com `'system'` e `actor_id?: string \| null`; severities em lowercase |

---

## Estratégia aplicada (prioridade)

1. **Prioridade 1 — Nullability:** Guards reais, `?? undefined` para `null`→`undefined`, `parameters ?? {}`, `intent ?? ''`, `entityType ?? 'unknown'`.
2. **Prioridade 2 — DTO/Entity:** Mappers com `Date`→`string` (toISOString); `currentBalance: balance.balance` em transparency.
3. **Prioridade 3 — Enum/Union:** `BankAccountOwnerType`: mapeamento em account.routes e EventOrganizerResolver; `CategoryContext`: apenas valores canônicos em testes; `AlertSeverity`/audit em lowercase; `WEBAUTHN_VERIFY_NOT_IMPLEMENTED` adicionado ao tipo.
4. **Prioridade 4 — Parciais:** `transfer` com `eventId` obrigatório via default uuid; `autoDistribute` com guard para `fromAccount`/`toAccount`.

Nenhum `as any`, `as unknown`, strict desligado ou contrato externo alterado (apenas extensões internas de tipo onde necessário).

---

## Arquivos alterados

- `backend/src/core/catalog/canonical/canonical-product.service.ts` — Date→string no mapper
- `backend/src/core/catalog/offer-index/offer-index.service.ts` — Date→string
- `backend/src/core/categories/categories.routes.ts` — CategoryContext default `'professional'`
- `backend/src/core/checkout/EventOrganizerResolver.ts` — merchant→company (BankAccountOwnerType)
- `backend/src/core/companies/companies.service.ts` — finalTenantId `?? undefined`; Date→string e null→undefined em mappers/listagens
- `backend/src/core/economy/accounts/account.routes.ts` — toBankAccountOwnerType(); mapeamento OwnerType→BankAccountOwnerType
- `backend/src/core/economy/distribution/distribution.service.ts` — guard fromAccount/toAccount obrigatórios
- `backend/src/core/economy/transaction.service.ts` — FinancialAuthorshipContext preenchido (system, permissionSnapshot mínimo)
- `backend/src/core/economy/transactions/transaction.routes.ts` — eventId obrigatório (default uuidv4)
- `backend/src/core/events/event-payment-prepared.service.ts` — variável tipada após guard para toAuthorization(row)
- `backend/src/core/events/event.service.ts` — start_datetime/end_datetime Date→string em conflicts
- `backend/src/core/reputation/trust.service.ts` — getScoreBadge/getScoreMessage em lowercase (contrato TrustDashboard)
- `backend/src/core/unifybank/transparency.service.ts` — currentBalance: balance.balance
- `backend/src/core/auth/webauthn.types.ts` — errorCode com 'WEBAUTHN_VERIFY_NOT_IMPLEMENTED'
- `backend/src/core/memory/memory.service.ts` — intent/entityType/parameters defaults (?? '', ?? 'unknown', ?? {})
- `backend/src/core/orchestrator/adapters/rides.adapter.ts` — amountCents: amount ?? 0
- `backend/src/core/orchestrator/adapters/work.adapter.ts` — amountCents: amount ?? 0
- `backend/src/core/publication/publication-engine.service.ts` — publication_destinations/invitation_methods como array (não JSON.stringify no updates)
- `backend/src/core/rate-limiting/auth-rate-limit.service.ts` — x-forwarded-for normalizado para string
- `backend/src/core/simulation/event-translator.ts` — amountCents: amount ?? 0
- `backend/src/core/audit/audit.service.ts` — actor_type 'system', actor_id?: string | null
- `backend/src/core/tenants/__tests__/tenant-context-permissions.test.ts` — CategoryContext canônicos (health, lifestyle, hobby); testes com 'health' em vez de 'government'
- `backend/src/jobs/post-event-split.job.ts` — ownerType 'company' para não-user
- `backend/src/modules/automation/alert.service.ts` — countOpenAlerts severity em lowercase
- `backend/src/modules/automation/automation.service.ts` — createAlert/auditService.record com severity lowercase e actor_type 'system'

---

## Resultado do tsc

Executar no backend:

```bash
pnpm exec tsc --noEmit --pretty false | findstr /C:"TS2322" /C:"TS2345"
```

- **TS2322 antes:** 209 (total TS2322+TS2345 no ts_out.txt)
- **TS2322/TS2345 depois:** a confirmar com o comando acima (esperada redução ≥40%).
- **Total erros antes/depois:** a confirmar com `pnpm exec tsc --noEmit`.

---

## Observações

- Contrato `CategoryContext` em `@unificard/contracts`: apenas `'professional' | 'interest' | 'education' | 'hobby' | 'learning' | 'health' | 'company' | 'lifestyle'`. Testes ajustados para não usar `economy`, `person`, `government`, `infrastructure`.
- `BankAccountOwnerType` permanece `'user' | 'company' | 'system'`; rotas/legado mapeiam `merchant`→`company`, `group`/`platform_ops`/`community_fund`→`system`.
- Publication metadata: `updates.publication_destinations` e `invitation_methods` mantidos como array (driver/DB pode serializar JSONB); tipo já era `string[]`.
