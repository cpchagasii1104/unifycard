# Runbook — alertas e hints (INFRA-6, camada 2)

**Objectivo:** traduzir sinais de **`event_handler_failures`** e contadores derivados de **`metric_event`** (via `handler-metrics.service`) em priorização operacional.

**Norma:** `HANDLER_EXECUTION_AND_RELIABILITY.md` §7 · `CORE_OBSERVABILITY_CONTRACT.md`

**Prometheus / Alertmanager (Opção A):** regras em `ops/prometheus/rules/unificard-infra6-alerts.yml` (ex.: `HandlerDeadLetter`, `HandlerRetrySpike`); scrape de `…/metrics/handlers/prometheus`. Contexto e SLOs: `outbox-metrics-alerts.md` §8–13.

---

## 1. Regras (implementação actual)

O endpoint **`GET …/metrics/handlers/alert-hints`** aplica heurísticas **no processo** (sem pager):

| Condição | Nível | Acção sugerida |
|----------|--------|----------------|
| `COUNT(*) WHERE status = 'dead'` > 0 | **CRÍTICO** | Runbook `handler-failures.md` §2.2 — causa raiz antes de re-enfileirar |
| `COUNT(*) WHERE status IN ('pending','retrying')` > 50 | **DEGRADAÇÃO** | Verificar `handler-failure-worker`, DB, carga; queries em `backend/scripts/sql/handler_failures_pending_backlog_by_handler.sql` |
| `AVG(attempts)` ≥ 5 por `handler_key` | **DEGRADAÇÃO** | Possível bug ou dados inválidos; ver `last_error` e `event_log` |
| Contador em memória `handler_dead_letter_total` > 0 e DB indisponível | **CRÍTICO** (fallback) | Correlacionar com logs `[CANONICAL]` |

**Nota:** limiares numéricos do backlog são **ponto de partida**; ajustar por ambiente (staging vs produção).

---

## 2. Endpoints (métricas em processo)

Registados com o prefixo do módulo UnifyBank (tipicamente **`/admin/metrics/handlers`**):

| Rota | Conteúdo |
|------|----------|
| `GET /summary` | JSON: totais por família, agregação por `handler_key`, retries por minuto (últimos 15) |
| `GET /prometheus` | Texto Prometheus (contadores desde o arranque do processo) |
| `GET /snapshot` | Agregados SQL live (`pending`, `dead`, `AVG(attempts)`) |
| `GET /alert-hints` | `{ level, reasons, db }` conforme §1 |

---

## 3. Queries SQL (ficheiros)

- `backend/scripts/sql/handler_failures_pending_backlog_by_handler.sql`
- `backend/scripts/sql/handler_failures_dead_letter_by_handler.sql`
- `backend/scripts/sql/handler_failures_retry_pressure_by_handler.sql`

---

## 4. Cardinalidade

Etiquetas Prometheus incluem `tenant_id` truncado (>36 chars → prefixo + `_trunc`) para limitar cardinalidade em tenants muito longos. Em ambientes com **muitos** tenants distintos, preferir scrape agregado + dashboards a partir de **SQL snapshot** ou agregador de logs.
