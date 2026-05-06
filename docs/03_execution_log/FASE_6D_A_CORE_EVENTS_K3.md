# FASE 6D-A — core/events K3 (Repository / Row / QueryResult) — Log de Execução

**Data:** 2026-02-22  
**Modo:** ENGENHEIRO DE TIPOS — ARQUITETURAL (convenção K3 core/events)  
**Escopo:** Apenas `backend/src/core/events` (e `specs/`).

---

## 1. Convenção aplicada

- **Multi-row:** Query que retorna várias linhas → `runQueriesWithTenant<T>` → retorno `T[]`. Caller usa `.map`, `.length` normalmente.
- **Single-row:** Query que retorna no máximo uma linha (INSERT/UPDATE RETURNING *, SELECT ... LIMIT 1) → `runQueryWithTenant<T>` → retorno `T | undefined`. Caller usa `if (!row)` e `row` (nunca `row[0]` nem `row.length`).
- **Aggregate:** Query que retorna um valor agregado (ex.: COUNT) → `runQueryWithTenant<{ count: string }>` (ou tipo explícito). Caller acessa `result.count` (nunca `result.length` nem `result[0]`).
- **QueryResult:** Não vaza. Helpers já retornam `T | undefined` ou `T[]`; nenhuma alteração nos helpers foi necessária.

---

## 2. Arquivos alterados

| Arquivo | Alterações |
|---------|------------|
| `backend/src/core/events/event-custody.service.ts` | (1) Single row: `if (!row)` e `toCustody(row)` em vez de `row.length`/`row[0]`. (2) List: `listCustodiesByEvent` passou a usar `runQueriesWithTenant<CustodyRow>` e `rows.map(row => this.toCustody(row))`. (3) Aggregate: `hasExecutedSplit` e `hasReleasedPayment` passaram a usar `result != null && parseInt(result.count, 10) > 0` (sem `.length` nem `result[0]`). Import de `runQueriesWithTenant` adicionado. |
| `backend/src/core/events/event-payment-prepared.service.ts` | (1) Single row: em todos os pontos (create, revoke, getAuthorization, getActiveAuthorization) uso de `if (!row)` e `toAuthorization(row)` em vez de `row.length`/`row[0]`. (2) List: `listAuthorizationsByEvent` passou a usar `runQueriesWithTenant<PaymentAuthorizationRow>` e `rows.map(row => this.toAuthorization(row))`. Import de `runQueriesWithTenant` já presente. |

**Observação:** Os arquivos `operational-commitments.service.ts`, `event-economic-phase.service.ts`, `idempotency-tracker.ts` e `event-spec.service.ts` no estado atual do repositório já estavam alinhados à convenção (uso de `if (!row)` / `result != null`, `runQueriesWithTenant` onde há lista, sem `.rows`). Nenhuma alteração foi necessária neles nesta execução.

---

## 3. TS2339 antes / depois

| Métrica | Valor |
|--------|--------|
| **TS2339 antes (pós 6C)** | **301** |
| **TS2339 depois (pós 6D-A)** | **262** |
| **Redução** | **39** |

TS2339 restantes em `core/events` após 6D-A: **0** (nenhum erro K3 listado no diagnóstico permanece nesse módulo).

---

## 4. Confirmações

- **Nenhum cast introduzido:** Não foi usado `as`, `any`, `!` ou `as unknown as` para resolver erros.
- **Nenhum contrato externo alterado:** Apenas uso interno de retorno de query (single vs multi vs aggregate).
- **Nenhuma alteração de cálculo ou unidade:** Apenas alinhamento do caller ao tipo de retorno (Row | null vs Row[] vs aggregate).
- **Convenção “sem .rows”:** Service nunca vê `.rows`; repository usa apenas `runQueryWithTenant` (uma row) ou `runQueriesWithTenant` (array). Nenhum tipo expõe `QueryResult`.

---

## 5. Comando de verificação

```bash
cd backend && npx tsc --noEmit
```

Contagem TS2339: **262**. Nenhum TS2339 em arquivos de `core/events` relacionados ao cluster K3.

---

*FASE 6D-A concluída. Próximo passo sugerido: 6D-B (core/pilot) com a mesma convenção.*
