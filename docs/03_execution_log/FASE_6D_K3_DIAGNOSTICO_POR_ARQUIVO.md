# Pré-FASE 6D — Diagnóstico K3 por arquivo (Repository / Row / QueryResult)

**Data:** 2026-02-22  
**Modo:** ANALISTA ESTRUTURAL — somente mapeamento (nenhuma alteração de código)  
**Fonte:** `npx tsc --noEmit` no backend; filtro por cluster K3.

---

## 1. Resumo executivo

| Métrica | Valor |
|--------|--------|
| **Total TS2339 (backend)** | 301 |
| **TS2339 classificados como K3** | **58** |
| **Arquivos com pelo menos um K3** | **20** |
| **Módulos afetados** | **6** (core/events, core/pilot, core/user-group-allocation, core/companies, core/contextual-messaging, modules, scripts, services/tests) |

**Padrões dominantes:**
- **K3-A:** Caller usa retorno como array (`.length`, `.map`) mas tipo é Row ou objeto único → **44** ocorrências.
- **K3-C:** QueryResult / acesso direto a propriedade (ex.: `.tenant_id`) em vez de `.rows[0]` → **3** ocorrências.
- **K3-D / .rows:** Código acessa `.rows` em tipo que é uma única row ou `{ last_ticket }` / `{ status }` → **11** ocorrências.

**Convenção atual:** Não há convenção explícita e única. Alguns repositories retornam uma única Row (ou objeto de query), outros retornam array; callers assumem array em vários pontos, gerando TS2339.

---

## 2. Listagem por arquivo (K3 apenas)

Cada entrada: **arquivo** | **linha(s)** | **padrão** | **caller/repository** | **trecho/resumo**.

---

### 2.1 Core — Events

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/core/events/event-custody.service.ts` | 165, 223, 263, 288, 324 | K3-A | Caller | `.length` / `.map` em variável tipada como `CustodyRow` (uma única row). Repository retorna Row; service espera array. |
| `src/core/events/event-custody.service.ts` | 367, 391 | K3-A | Caller | `.length` em `{ count: string }` (resultado de COUNT query). |
| `src/core/events/event-payment-prepared.service.ts` | 168, 224, 249, 275, 300 | K3-A | Caller | `.length` / `.map` em `PaymentAuthorizationRow` (uma única row). |
| `src/core/events/event-economic-phase.service.ts` | 164, 188 | K3-A | Caller | `.length` em `{ count: string }`. |
| `src/core/events/operational-commitments.service.ts` | 115, 138, 171, 218, 265, 310, 337, 363 | K3-A | Caller | `.length` / `.map` em `OperationalCommitmentRow` ou em `{ id, tenant_id }` / `{ actor_id }`. |
| `src/core/events/idempotency-tracker.ts` | 74 | K3-A | Caller | `.length` em `IdempotencyTracking` (objeto único). |
| `src/core/events/specs/event-spec.service.ts` | 175, 176, 254, 258, 273, 277, 334, 359, 365, 414, 418, 464, 468, 526, 530 | K3-D / .rows | Caller | Acesso a `.rows` em tipo `{ last_ticket: string }`, `EventSpecRow` (uma row), `{ status: string }`. Query retorna single row ou aggregate; código espera estrutura com `.rows`. |

**Módulo core/events:** **29** ocorrências K3. Padrão dominante: repository (ou query) retorna **uma Row** ou **objeto de aggregate**; service usa como **array** (`.length`, `.map`) ou espera **`.rows`**. Convenção atual: implícita e inconsistente (às vezes array, às vezes single row).

---

### 2.2 Core — Pilot

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/core/pilot/institutional-memory.repository.ts` | 120, 210, 243 | K3-A | Repository / Caller | `.map` / `.length` em tipo que é uma única row ou `{ count: number }`. |
| `src/core/pilot/pilot-checklist.repository.ts` | 121, 150 | K3-A | Repository | `.map` em uma única row ou `{ observed_user_id }`. |
| `src/core/pilot/pilot-events.repository.ts` | 132, 194 | K3-A | Repository | `.length` / `.map` em uma única row. |
| `src/core/pilot/pilot-hypotheses.repository.ts` | 87 | K3-A | Repository | `.map` em uma única row. |
| `src/core/pilot/pilot-notes.repository.ts` | 94 | K3-A | Repository | `.map` em uma única row. |

**Módulo core/pilot:** **8** ocorrências K3. Padrão: **repository** retorna **uma Row** (ou objeto de query); código no próprio repository usa `.map`/`.length` como se fosse array. Convenção atual: retorno tipado como single Row; implementação ou caller trata como array.

---

### 2.3 Core — User-group-allocation

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/core/user-group-allocation/user-group-allocation.repository.ts` | 113, 197, 217 | K3-A | Repository | `.length` em uma única row ou `{ count: string }`. |

**Módulo core/user-group-allocation:** **3** ocorrências K3. Mesmo padrão: retorno é single row ou aggregate; uso como array.

---

### 2.4 Core — Companies

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/core/companies/companies.service.ts` | 656 | K3-C | Caller | `Property 'tenant_id' does not exist on type 'QueryResult<{ tenant_id: string; }>'`. Acesso direto a propriedade em vez de `.rows[0].tenant_id` (ou tipo explícito de “uma linha”). |

**Módulo core/companies:** **1** ocorrência K3. Padrão: **QueryResult** mal tipado no uso (acesso direto a campo da row).

---

### 2.5 Core — Contextual-messaging

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/core/contextual-messaging/contextual-thread.repository.ts` | 200, 308 | K3-A | Repository | `.map` em `ContextualThreadRow` e `ContextualMessageRow` (uma row cada). |

**Módulo core/contextual-messaging:** **2** ocorrências K3. Repository retorna single Row; código usa `.map` como se fosse array.

---

### 2.6 Modules — Organization

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/modules/organization/organization-invite.service.ts` | 128 | K3-A | Caller | `.length` em `{ user_id: string; email: string; }` (uma row). |

**Módulo modules/organization:** **1** ocorrência K3.

---

### 2.7 Modules — System-notifications

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/modules/system-notifications/system-notification.repository.ts` | 165 | K3-A | Repository | `.map` em `SystemNotificationRow` (uma row). |

**Módulo modules/system-notifications:** **1** ocorrência K3.

---

### 2.8 Scripts

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/scripts/seed-dev-companies-services.ts` | 194, 195, 246 | K3-D / .rows | Caller | `.rows` em tipo `{ actor_id: string }` e `{ service_id: string }` (uma row cada). Query retorna single row; código espera estrutura com `.rows`. |

**Scripts:** **3** ocorrências K3. Padrão: mesmo que event-spec (acesso `.rows` em resultado de query que é uma row).

---

### 2.9 Services — Events (testes)

| Arquivo | Linhas | Padrão | Onde | Resumo |
|---------|--------|--------|------|--------|
| `src/services/events/tests/event_checkout_hardening.test.ts` | 80, 81 | K3-C | Caller | `tenant_id` / `city_id` em `QueryResult<{ tenant_id: string }>` — acesso direto em vez de `.rows[0]`. |

**Services/events (testes):** **2** ocorrências K3. Mesmo padrão QueryResult que companies.

---

## 3. Agrupamento por módulo

| Módulo | Arquivos | Ocorrências K3 | Padrão dominante | Convenção atual |
|--------|----------|----------------|------------------|-----------------|
| **core/events** | 6 | 29 | K3-A (array esperado, single row retornado); K3-D (.rows em single/aggregate) | Implícita; mistura single row e aggregate; alguns métodos esperam array. |
| **core/pilot** | 5 | 8 | K3-A (repository retorna single row; uso .map/.length) | Repository retorna single Row; uso interno como array. |
| **core/user-group-allocation** | 1 | 3 | K3-A | Single row / { count }; uso como array. |
| **core/companies** | 1 | 1 | K3-C (QueryResult) | Acesso direto a propriedade do resultado de query. |
| **core/contextual-messaging** | 1 | 2 | K3-A | Single Row; .map no repository. |
| **modules/organization** | 1 | 1 | K3-A | Single row; caller usa .length. |
| **modules/system-notifications** | 1 | 1 | K3-A | Single Row; .map no repository. |
| **scripts** | 1 | 3 | K3-D (.rows) | Query retorna uma row; código usa .rows. |
| **services/events (tests)** | 1 | 2 | K3-C (QueryResult) | Idem companies. |

---

## 4. Recomendações de convenção por módulo (para FASE 6D)

- **core/events**  
  - **Decisão:** Definir por método: se a query retorna múltiplas linhas → tipo de retorno `Row[]` (ou `CustodyRow[]`, etc.) e/ou helper que sempre retorna array (ex.: `[]` quando nenhuma linha). Se retorna uma linha ou aggregate → tipo `Row | null` ou `{ count: string }` etc., e **caller** não usa `.length`/`.map` sem checagem/array.  
  - **Event-spec:** Alinhar tipo de retorno da query com o uso: ou retornar `{ rows: EventSpecRow[] }` (ou array) e usar `.rows`/array, ou retornar uma row e tratar como único no caller.  
  - **Evitar:** mesmo método retornar às vezes array às vezes single row sem tipo que reflita isso.

- **core/pilot**  
  - **Decisão:** Repositories que hoje retornam **uma Row** devem declarar retorno `Row | null` (ou equivalente). Chamadas que precisam de **lista** devem usar método que retorna `Row[]` (ex.: `runQueriesWithTenant` que devolve array) ou mapper explícito.  
  - **Convenção sugerida:** “Queries que selecionam múltiplas linhas retornam `Row[]`; queries que selecionam uma linha retornam `Row | null`. Nenhum uso de `.map`/`.length` em variável tipada como single Row.”

- **core/user-group-allocation**  
  - **Decisão:** Idem pilot: retorno ou é array de rows ou single row/aggregate; tipo e uso alinhados (sem .length em single row).

- **core/companies**  
  - **Decisão:** Tratar resultado de query como estrutura com rows: tipo `QueryResult<Row>` e uso `result.rows[0].tenant_id`, ou helper que retorna `Row | null` já extraindo `rows[0]`. Não acessar propriedade direta em `QueryResult`.

- **core/contextual-messaging**  
  - **Decisão:** Métodos que precisam de lista devem retornar `Row[]`; se a query retorna uma row, retorno `Row | null` e caller não usa `.map`.

- **modules/organization**  
  - **Decisão:** Caller que usa `.length` deve receber array; repository deve retornar `Row[]` (ou tipo com `.rows`) para esse método.

- **modules/system-notifications**  
  - **Decisão:** Idem pilot/contextual: retorno `Row[]` onde se usa `.map`, ou `Row | null` e sem .map.

- **scripts**  
  - **Decisão:** Alinhar tipo do resultado da query com o uso: ou retornar estrutura com `.rows` (ex.: tipo do driver) ou extrair `rows[0]` e tipar como uma row; não acessar `.rows` em tipo que é uma row.

- **services/events (testes)**  
  - **Decisão:** Mesma regra que companies: uso de `QueryResult` com `.rows[0]` ou helper que retorna uma row tipada.

---

## 5. Riscos e ambiguidades (decisão antes da 6D)

1. **RunQueryWithTenant / RunQueriesWithTenant**  
   - Comportamento real do pool: retorna **uma row** ou **array de rows**? Se a assinatura genérica for `Promise<T>`, o tipo `T` pode ser uma row quando a query retorna uma linha e array quando retorna várias — isso gera exatamente o padrão K3-A. **Recomendação:** Documentar ou tipar de forma explícita: por exemplo, “runQueryWithTenant retorna uma row (`T`), runQueriesWithTenant retorna `T[]`”, e ajustar tipos de retorno dos repositories em conformidade.

2. **Event-spec e scripts: .rows**  
   - Se o driver (pg) retorna objeto com `.rows`, o tipo genérico usado pode estar perdendo essa informação (ex.: tipado como `T` em vez de `{ rows: T[] }`). **Recomendação:** Verificar assinatura real do helper de query e, se for o caso, expor `{ rows: Row[] }` ou sempre devolver array para listas.

3. **Convenção global**  
   - Adotar uma regra única para o backend: “repositories retornam sempre **Row** ou **Row[]** (nunca QueryResult vazando); services que precisam de Entity fazem mapper em um único lugar (no repository ou no service).” Isso evita mistura Row/Entity no mesmo método e reduz K3-B em fases futuras.

---

## 6. Critério de sucesso do diagnóstico

- [x] Todos os TS2339 plausivelmente K3 listados e classificados por arquivo e por padrão (K3-A, K3-C, K3-D).
- [x] Módulos com maior concentração de K3 têm convenção atual e recomendada descritas.
- [x] Documento permite executar a FASE 6D por sub-bloco coeso (por módulo) sem retrabalho desnecessário.
- [x] Riscos e ambiguidades (QueryResult, runQuery vs runQueries, .rows) identificados para decisão pré-6D.

---

*Diagnóstico concluído. Nenhuma alteração de código foi feita. Próximo passo: definir convenção (e eventual ajuste de helpers de query) e executar FASE 6D por módulo.*
