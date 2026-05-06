# Runbook — falhas de handler (`event_handler_failures`)

**Objectivo:** operar a **camada 2** (execução de handlers após `publish`): identificar falhas, retries, dead-letter e recuperação manual **sem** republicar eventos nem alterar a outbox.

**Norma:** `docs/01_normative/HANDLER_EXECUTION_AND_RELIABILITY.md`  
**Schema:** `backend/migrations/20260511120000_event_handler_failures.sql`  
**Código:** `event-handler-failure.repository.ts`, `handler-failure.processor.ts`, `handler-failure-worker.ts`, `event-bus.ts`

---

## 1. O que é cada estado

| `status` | Significado |
|----------|-------------|
| `pending` | Aguarda janela `next_retry_at`; elegível para o worker. |
| `retrying` | Linha reclamada pelo worker; em processamento. Órfãs (`updated_at` > ~15 min sem conclusão) voltam a ser elegíveis. |
| `dead` | **Dead-letter de handler:** esgotou `max_attempts` (default 10) ou política equivalente. **Não** há mais retry automático. |

**Unidade lógica:** `(tenant_id, event_id, handler_key)` — uma linha por combinação.

---

## 2. Como identificar falhas (operacional)

### 2.1 Fila activa (precisa atenção)

```sql
SELECT id, tenant_id, event_id, event_type, handler_key, attempts, max_attempts,
       next_retry_at, status, last_error, created_at, updated_at
FROM event_handler_failures
WHERE status IN ('pending', 'retrying')
ORDER BY next_retry_at ASC NULLS LAST, created_at ASC
LIMIT 100;
```

### 2.2 Dead-letter (DLQ de handler)

```sql
SELECT COUNT(*) AS dead_count
FROM event_handler_failures
WHERE status = 'dead';

SELECT *
FROM event_handler_failures
WHERE status = 'dead'
ORDER BY updated_at DESC
LIMIT 50;
```

### 2.3 Logs estruturados (métricas v1)

Filtrar agregador / Loki / CloudWatch pelo campo **`metric_event`** (contexto do `canonicalLogger`):

| `metric_event` | Quando |
|----------------|--------|
| `handler_failure_created` | Após persistir falha a partir de execução **live** no `publish` (primeira ou actualização da linha). |
| `handler_retry_attempt` | Antes de cada `invokeHandlerOnly` no worker. |
| `handler_dead_letter` | Após upsert quando `status = dead`. |
| `handler_failure_event_log_missing` | Replay impossível: não há linha em `event_log` para `(tenant_id, event_id)`. |
| `handler_retry_failed` | Tentativa de retry terminou em excepção (novo upsert / eventual `dead`). |

**Séries mínimas recomendadas (INFRA-6):** contagens por hora de `handler_failure_created`, `handler_dead_letter`, `handler_retry_attempt`; alerta se `dead_count` cresce ou `pending` antigo > SLA.

### 2.4 HTTP (processo) — agregação em memória + SQL

Sob o prefixo admin do UnifyBank (ex.: **`/admin/metrics/handlers`**):

| Método | Caminho | Uso |
|--------|---------|-----|
| GET | `/summary` | Dashboard mínimo JSON (contadores desde boot + retries/min) |
| GET | `/prometheus` | Scrape Prometheus (mesmas séries, labels `handler_key`, `event_type`, `tenant_id`) |
| GET | `/snapshot` | Agregados em tempo real sobre `event_handler_failures` |
| GET | `/alert-hints` | Classificação `ok` / `degraded` / `critical` + motivos |

Código: `backend/src/core/observability/handler-metrics.service.ts`, `handler-metrics.routes.ts`.  
Regras de alerta: `docs/runbooks/handler-metrics-alerts.md`.

### 2.5 SQL utilitário (repo)

- `backend/scripts/sql/handler_failures_pending_backlog_by_handler.sql`
- `backend/scripts/sql/handler_failures_dead_letter_by_handler.sql`
- `backend/scripts/sql/handler_failures_retry_pressure_by_handler.sql`

---

## 3. Dependência crítica: `event_log`

O retry **não** chama `publish` de novo: reconstrói o `UnificardEvent` a partir de **`event_log`** (com contexto de tenant / RLS).

- Se **`event_log` não tiver a linha** (retenção, corrupção, ambiente sem tabela, UUID errado): o worker regista erro persistido e emite `handler_failure_event_log_missing`.
- **Acção:** restaurar backup / reconciliar evento; ou corrigir dados e **reprocessar manualmente** (§4). Não assumir que o efeito do handler correu.

---

## 4. Reprocessamento manual

### 4.1 Re-enfileirar um dead ou pending “congelado”

1. Confirmar causa em `last_error` e que o **bug / dados** foram corrigidos.
2. Opcional: verificar que `event_log` ainda tem o evento:

```sql
SELECT event_id, event_type, created_at
FROM event_log
WHERE tenant_id = $tenant::uuid AND event_id = $event::uuid;
```

3. Repor fila (exemplo: voltar a `pending` com retry imediato):

```sql
UPDATE event_handler_failures
SET status = 'pending',
    next_retry_at = NOW(),
    updated_at = NOW()
WHERE id = $failure_id::uuid
  AND status = 'dead';  -- ou pending, conforme política interna
```

4. O worker (`handler-failure-worker`) pickará na próxima janela (ou invocar `processHandlerFailureCycle()` em manutenção controlada).

**Proibido:** chamar `eventBus.publish` só para “passar o evento outra vez” — isso re-dispara **todos** os handlers do tipo se o `event_log` aceitar novo `event_id`; o caminho canónico é **`invokeHandlerOnly`** com o **mesmo** `event_id` (feito pelo processor).

### 4.2 Ignorar um falso positivo / efeito já aplicado

Se idempotência garante que o efeito **já** está correcto (ex.: duplicata benigna):

1. Documentar decisão (ticket / post-mortem).
2. Remover a linha:

```sql
DELETE FROM event_handler_failures WHERE id = $failure_id::uuid;
```

**Só** após confirmação de negócio / dados.

---

## 5. Quando marcar como `dead` vs corrigir dados

| Situação | Acção típica |
|----------|----------------|
| Bug de código permanente em produção | Corrigir release; depois §4.1 ou DELETE após replay bem-sucedido em staging. |
| Dados inválidos no payload | Corrigir fonte / migração pontual; §4.1. |
| Dependência externa (API) indisponível | Esperar recuperação; backoff já aplica; se `dead`, §4.1 após serviço estável. |
| Efeito financeiro em risco | **Parar** — escalar; Lei 5 / guarda; não “ignorar” sem análise. |
| Read model desactualizado (ver norma §8) | Preferir **rebuild** / job de projeção conforme `HANDLER_EXECUTION_AND_RELIABILITY.md`; não misturar com DLQ de negócio sem critério. |

---

## 6. Testes de regressão

Com `DATABASE_URL` e migrations aplicadas:

```bash
cd backend && pnpm test:integration:event-outbox-infra
```

Inclui **PASSO 6** (falha de handler → `event_handler_failures` → retry só por `handler_key`).

---

## 7. Remissões

- `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` — camada 1 (outbox / publish)
- `docs/runbooks/event-outbox-operational-proof.md` — prova outbox
- `HANDLER_EXECUTION_AND_RELIABILITY.md` — lei de execução, observabilidade (§7), read models (§8)
