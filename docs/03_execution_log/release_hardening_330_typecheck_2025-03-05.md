# Log de Execução — Release Hardening Typecheck (330 → 0)

**Data:** 2025-03-05  
**Modo:** EXECUTOR  
**Objetivo:** Zerar typecheck do backend (330 erros) sem quebrar contrato REST/DB/APIs.

## Normativa seguida

- `docs/01_normative/00_AGENT_PROTOCOL.md`
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md`
- Trechos de `docs/CONSOLIDADO_NORMATIVO_COMPLETO.txt` (money, query, date)

## Resultado desta sessão

| Métrica            | Antes | Depois |
|--------------------|-------|--------|
| Erros TS (total)   | 330   | **265** |
| Erros reduzidos    | —     | **65**  |

## Arquivos alterados

### CLUSTER 1 — src/core/unifybank/**
- `src/core/unifybank/regional-fund-governance.service.ts` — Tipos de row de proposta: genéricos das queries com `amountCents` refletiam incorretamente o DB; corrigido para `amount` (nome da coluna) para bater com `RETURNING *` / `SELECT *` e com `toProposal(row)` / `toProposalWithExecution(row)`.

### Core (insight, memory, rbac, tenants, policy, publication, rate-limiting, referral, read-models, simulation, orchestrator, user-group-allocation)
- `src/core/rbac/rbac.service.ts` — Date → string em `toRole`/`toPermission` (toISOString); `runQueryWithTenant` retorna `T | undefined`, removido uso de `.length` em `role`.
- `src/core/rbac/role.service.ts` — Date → string em retorno de role.
- `src/core/tenants/tenant.service.ts` — Date → string em retorno de tenant (getTenantById, setTenantRegion).
- `src/core/insight/insight-engine.ts` — Uso de `CanonicalEvent`: `amount` → `amountCents` (filtros e acumulados).
- `src/core/orchestrator/canonical-orchestrator.service.ts` — Log: `event.amount` → `event.amountCents`.
- `src/core/orchestrator/adapters/work.adapter.ts` — Objeto `CanonicalEvent`: `amount` → `amountCents`.
- `src/core/orchestrator/adapters/rides.adapter.ts` — Idem.
- `src/core/simulation/event-translator.ts` — Objeto `CanonicalEvent`: campo `amount` → `amountCents`.
- `src/core/simulation/event-log.source.ts` — Filtros: `canonicalEvent.amount` → `canonicalEvent.amountCents`.
- `src/core/simulation/simulation-engine.ts` — Uso de `event.amount` → `event.amountCents`.
- `src/core/memory/memory.model.ts` — `row.value` → `row.valueCents` (UserMemoryPreferenceRow).
- `src/core/memory/memory.repository.ts` — RETURNING/SELECT com alias `value AS "valueCents"`; parâmetro `data.valueCents`.
- `src/core/memory/memory.service.ts` — `pref.value` → `pref.valueCents`.
- `src/core/policy-resolution/policy-resolution-engine.ts` — `policy.value` → `policy.valueCents`.
- `src/core/policy/policy-registry.ts` — `policy.value` → `policy.valueCents`.
- `src/core/publication/publication-engine.service.ts` — Atribuição a `publication_destinations`/`invitation_methods` (string vs string[]) com type assertion para objeto de update.
- `src/core/rate-limiting/auth-rate-limit.service.ts` — Tipo de `ips` e retorno string garantido (x-forwarded-for).
- `src/core/social/ports/actor-effect.port.ts` — Inclusão de enums faltantes: `OPPORTUNITY_DISPATCHED`, `OPPORTUNITY_DISPATCH_RESPONDED`, `IMPACT_RECORDED`, `NOTIFICATION_SENT`.
- `src/core/referral/referral-helper.service.ts` — `runQueryWithTenant` retorna `T | undefined`; removido `.length` e uso de `[0]`.
- `src/core/user-group-allocation/user-group-allocation.repository.ts` — `runQueryWithTenant` vs `runQueriesWithTenant`; `findByUserId` com `runQueriesWithTenant` e `{ text, values }`; `deleteAllByUserId` com `runQueriesWithTenant`; `countByUserId` com `result?.count`; removido `.length` onde row único.
- `src/core/user-group-allocation/user-group-allocation.routes.ts` — Payload tipado explicitamente como `SetUserGroupAllocationInput` (allocations com groupId e percentage obrigatórios).

### Módulos
- `src/modules/marketplace/fiscal-provider.interface.ts` — Reexport dos tipos `FiscalDocumentData`, `FiscalIssueResult`, `FiscalCancelResult`, `FiscalStatus`.
- `src/modules/bank/bank-ledger.repository.ts` — `BankLedgerRow` com `amount` (coluna DB); `toLedgerEntry` usa `row.amount`; `CreateBankLedgerEntryInput` usa `amountCents` no destructuring e no array de VALUES; colunas SQL mantidas como `amount` (sem mudança de schema).

## Códigos de erro mais atacados

- **TS2339** — Propriedade inexistente (amount vs amountCents, total vs totalCents, value vs valueCents, .length em T|undefined).
- **TS2322** — Date vs string (conversão com toISOString()/String()).
- **TS2345** — Argumentos (tipos de runQuery/objetos de input).
- **TS2353** — Objeto literal com propriedade inexistente (amount vs amountCents).
- **TS2367** — Comparação enum/literal (não alterado nesta sessão; enums em outros módulos).
- **TS2304/TS2724** — Símbolo ausente (ActorEffect enums adicionados no port).

## Aderência ao canon

- **Dinheiro:** amountCents/totalCents/valueCents no TS; SQL com nome de coluna existente (ex.: `amount`) mantido; alias só onde necessário (ex.: memory `value AS "valueCents"`).
- **Queries:** Uso de `runQueryWithTenant<T>(tenantId, { text, values })` e `runQueriesWithTenant<T>(tenantId, { text, values })` onde ajustado; sem 3º argumento em novos trechos no user-group-allocation.
- **Date vs string:** Onde o tipo de saída exige string, conversão com `toISOString()` ou `String()`.
- **Contratos REST/DB:** Nenhuma alteração de assinatura pública, schema de DB ou contrato REST; apenas tipagem, aliases e adapters internos.

## Próximos passos sugeridos (265 erros restantes)

1. **Repetir padrões:** amount/amountCents e total/totalCents nos módulos bank (bank-split, bank-limit, bank-balance-by-region), payments (payment-link, pix), care, contextual-messaging, business-audit, subscriptions, reports, rides, social, work, votes, etc.
2. **Enums/literais:** Ajustar comparações e tipos para enums canônicos (AgreementStatus, AlertStatus, AuditSeverity "low"/"medium", InvoiceStatus, OrderStatus, etc.) ou estender tipos onde o valor é válido em runtime.
3. **runQueryWithTenant:** Migrar chamadas `(tenantId, sql, params)` para `(tenantId, { text: sql, values: params })` em agreements, evidence, invoice, etc.
4. **Stubs/export:** Módulos ausentes (schedule.types, payment-transaction.repository, buildApp, OrganizationUnit, ConsolidationScope, ServiceBooking/ServiceOffering em @contracts/marketplace) — criar stub tipado mínimo ou remover referência morta.
5. **AuditEventInput / AuditSource:** Preencher event_type, severity, source, context onde hoje se passa `Record<string, any>`; ou estender tipo se novos sources forem canônicos.

## Status

**SUCESSO PARCIAL** — Redução de 65 erros (330 → 265). Contratos e canon respeitados. Execução pode ser retomada a partir da lista de erros em `backend/ts-errors.txt` (ou nova saída de `npx tsc -p tsconfig.build.json --noEmit`).
