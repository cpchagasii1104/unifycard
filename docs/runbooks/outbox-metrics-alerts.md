# Runbook — métricas e alertas da outbox (INFRA-6 GLOBAL)

**Objectivo:** operar **camada 1** (`event_outbox`, `event_outbox_failed`) com visibilidade de backlog, latência até `event_log`, throughput, retries e DLQ — **sem** alterar fluxo de publicação.

**Norma:** `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` · `docs/runbooks/event-outbox-operational-proof.md`  
**Código (só leitura):** `backend/src/core/events/outbox-metrics.service.ts`, `outbox-metrics.routes.ts`  
**SQL utilitário:** `backend/scripts/sql/outbox_health.sql`, `outbox_latency.sql`, `outbox_backlog.sql`

---

## 1. Endpoints HTTP (processo)

Registados sob o prefixo UnifyBank (ex.: **`/admin/metrics/outbox`** e espelho **`/bank/metrics/outbox`**):

| Rota | Conteúdo |
|------|----------|
| `GET /summary` | JSON: `outbox` (contagens, lag, throughput, DLQ, pressão, backlog antigo) + `latency` + `handlers` (snapshot DB + totais de log em memória) |
| `GET /prometheus` | Texto Prometheus (gauges `outbox_*`, latência se disponível, totais handler failures) |
| `GET /alert-hints` | `{ level, reasons, consolidated }` — heurísticas abaixo |

---

## 2. Interpretação — backlog

- **`pending`:** linhas com `published_at IS NULL` — fila a consumir pelo worker.
- **`oldest_pending_seconds`:** idade do `created_at` mínimo entre pendentes; **> 300 s** nos `alert-hints` ⇒ **CRÍTICO** (worker parado, DB lento, ou pressão extrema).
- **`pending_older_than_15m`:** indicador de **drift operacional** (itens presos); não é divergência de SSOT de inventário, é atraso de entrega.

**Acções:** verificar `event-outbox-worker`, logs do processor, `next_retry_at` / `attempts` em `event_outbox`; runbook outbox operacional.

---

## 3. Latência (pipeline outbox → `event_log`)

- Mede **tempo entre** `event_outbox.created_at` e **`event_log.created_at`** para linhas publicadas na janela de **15 minutos**.
- **`avg_latency_seconds` / `max_latency_seconds`:** se **média > 60 s** ou **máximo > 120 s**, `alert-hints` tende a **DEGRADED** (thresholds iniciais, ajustar por ambiente).

### 3.1 Histograma (p50 / p95 / p99)

- Métricas: `outbox_pipeline_latency_seconds_bucket{le="…"}`, `_sum`, `_count` (expostas em `…/metrics/outbox/prometheus`).
- Buckets (s): **0,1 · 0,5 · 1 · 2 · 5 · 10 · +Inf**; contagens **cumulativas** na janela SQL (recomputadas a cada scrape).
- **Tipo:** buckets/sum/count são **gauges** (snapshot da janela móvel), **não** counters monótonos → **não** usar `rate()` / `increase()` nos `_bucket`.
- **Quantis no Prometheus/Grafana:** `histogram_quantile(0.99, sum by (le) (outbox_pipeline_latency_seconds_bucket))` (e p50/p95) **no instante do scrape**; para tendência, grafar essa expressão ao longo do tempo (cada ponto = p99 da janela nesse momento).
- **SQL de referência:** `backend/scripts/sql/outbox_latency_histogram.sql`.
- **Alertas:** `HighOutboxLatencyP99` em `unificard-infra6-alerts.yml`; recording rules `slo_outbox_pipeline_latency_p*_seconds` em `unificard-infra6-slo-recording.yml`.

**Caveat RLS:** `event_log` tem RLS por tenant; ligações com utilizador sem visão global podem devolver **subconjunto** ou falhar silenciosamente no serviço (latência omitida). Para métricas de plataforma, usar role operacional com leitura adequada.

---

## 4. Throughput

- **`published_5m` / `published_15m`:** volume publicado no intervalo — útil para gráficos de taxa e comparar com carga de negócio.

---

## 5. Retry e DLQ (camada 1)

- **`high_retry_pressure`:** pendentes com `attempts >= 3` — possível instabilidade de `publish` ou dependências.
- **`dlq_count`:** linhas em **`event_outbox_failed`** — qualquer **> 0** ⇒ **CRÍTICO** nos hints; requer análise e reprocessamento conforme runbook DLQ.

**Camada 2 (handlers):** totais `handler_failures_*` no Prometheus e bloco `handlers` no summary; dead letters de handler continuam em `docs/runbooks/handler-failures.md`.

---

## 6. `alert-hints` — resumo

| Nível | Condições típicas |
|--------|-------------------|
| **CRÍTICO** | `dlq_count > 0`; `oldest_pending_seconds > 300`; `handler_dead_total > 0` |
| **DEGRADED** | `high_retry_pressure > 0`; `pending_older_than_15m > 0`; latência acima dos limiares |
| **OK** | Nenhuma das acima |

**Nota:** não dispara pager por si; integrar com Prometheus/Alertmanager ou equivalente usando as mesmas séries e regras.

---

## 7. Ligação com handlers

O summary agrega **handlers** (`event_handler_failures` + contadores em memória da camada 2) para uma vista **ponta-a-ponta** na mesma resposta; runbooks específicos: `handler-failures.md`, `handler-metrics-alerts.md`.

---

## 8. SLOs de referência (Opção A — produção)

| ID | Objectivo | Métrica / proxy | Nota |
|----|-----------|-----------------|------|
| SLO 1 | 99% entregues em ≤ 5s | `outbox_latency_avg_seconds` (janela SQL 15m) | Sem histogram; calibrar com carga real; alerta **HighOutboxLatency** > 5s |
| SLO 2 | 99,9% handlers sem falha persistente | `rate(handler_failure_created_total[5m])` | Recording `slo_handler_failure_rate_5m` |
| SLO 3 | Zero dead | `sum(handler_dead_letter_total)`, `handler_failures_dead_total` | Alerta **HandlerDeadLetter** |
| SLO 4 | Backlog saudável | `outbox_pending < 100`, `outbox_oldest_pending_seconds < 60` | Ajustar **OutboxBacklogGrowing** / **OutboxStuck** ao SLO |
| SLO 5 | Throughput se sistema ativo | `outbox_published_5m > 0` | **OutboxNoThroughput** quando há backlog e janela 5m a zero |

**Error budget (Prometheus):** ficheiro `ops/prometheus/rules/unificard-infra6-slo-recording.yml` — séries `slo_outbox_latency_violation_total` e `slo_handler_failure_violation_total` (0/1 por avaliação); em Grafana usar `sum_over_time(...[30d:])` ou painel SLO conforme versão.

---

## 9. Prometheus + Alertmanager (ficheiros no repo)

| Ficheiro | Uso |
|----------|-----|
| `ops/prometheus/rules/unificard-infra6-alerts.yml` | `rule_files` no `prometheus.yml` |
| `ops/prometheus/rules/unificard-infra6-slo-recording.yml` | recording rules (carregar **antes** ou **junto** dos alerts que dependem dos `slo_*`) |
| `ops/alertmanager/unificard-infra6-route.fragment.yml` | Exemplo de encaminhamento por `severity` |
| `ops/prometheus/prometheus.scrape-example.yml` | Comentário com dois `scrape_configs` |

**Scrape:** dois targets HTTP (mesmo host, paths diferentes), p.ex. `https://api…/admin/metrics/outbox/prometheus` e `…/admin/metrics/handlers/prometheus` (ou `/bank/…`). Métricas `handler_*` vivem no segundo; `outbox_*` e `handler_failures_*` no primeiro.

**Métricas esperadas (resumo):** `outbox_pending`, `outbox_retrying`, `outbox_dlq_total`, `outbox_latency_avg_seconds`, `outbox_latency_max_seconds`, `outbox_oldest_pending_seconds`, `handler_failure_created_total`, `handler_retry_attempt_total`, `handler_dead_letter_total` (com labels), derivadas `rate(...[5m])` nos alertas.

---

## 10. Grafana

Importar `ops/grafana/dashboards/unificard-infra6.json` (datasource Prometheus). Painéis: Outbox health, backlog, throughput, latência, SLO recording, fiabilidade de handlers, dead letters.

---

## 11. Encaminhamento de alertas

| Severidade | Canal sugerido | Alertas típicos |
|------------|----------------|-----------------|
| **critical** | Pager / Slack imediato | HandlerDeadLetter, OutboxStuck, OutboxNoThroughput, OutboxDlqNonZero |
| **warning** | Slack | HandlerRetrySpike, HighOutboxLatency, HighOutboxLatencyP99, OutboxBacklogGrowing |

Ver fragmento em `ops/alertmanager/unificard-infra6-route.fragment.yml`.

---

## 12. Quando CRITICAL — acções

| Alerta | Acção |
|--------|--------|
| **HandlerDeadLetter** | `SELECT * FROM event_handler_failures WHERE status='dead'`; runbook `handler-failures.md` |
| **OutboxStuck** | Worker outbox activo? Locks em `event_outbox`? CPU/DB; `event-outbox.processor` |
| **OutboxNoThroughput** | Crash do worker, falha repetida em `publish`, rede; logs processor |
| **OutboxDlqNonZero** | Inspeccionar `event_outbox_failed`; runbook DLQ outbox / `event-outbox-operational-proof.md` |

---

## 13. Quando WARNING — acções

| Alerta | Acção |
|--------|--------|
| **HandlerRetrySpike** | Agrupar por `handler_key` / `event_type` no Prometheus; causa em `last_error` |
| **HighOutboxLatency** | Latência média; comparar com SLO 5s |
| **HighOutboxLatencyP99** | p99 do histograma; cauda lenta mesmo com média baixa |
| **OutboxBacklogGrowing** | Escalar réplicas do worker ou optimizar consumo; ver `outbox_backlog.sql` |
