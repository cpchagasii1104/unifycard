# Runbook — Sagas de pedido (INFRA-4)

Coordenação **persistida** entre fases (`Order → Payment → Fulfillment → Ledger`) via tabela `order_sagas`. Eventos de transição são escritos em `event_outbox` (entrega garantida pelo worker existente). **Não** altera o contrato do `event_bus` nem handlers existentes até estarem subscritos aos novos tipos.

## Estados e passos

| `status`           | Significado canónico        |
|--------------------|-----------------------------|
| `created`          | Saga iniciada               |
| `payment_pending`  | À espera de pagamento       |
| `paid`             | Pagamento confirmado        |
| `fulfilled`        | Fulfillment concluído       |
| `failed`           | Falha explícita             |
| `cancelled`        | Cancelada por timeout       |

Transições válidas: `created → payment_pending → paid → fulfilled`. Qualquer estado não terminal pode ir para `failed` via `failSaga`. Timeout move para `cancelled`.

## Invariantes críticas — saga + pagamento (marketplace)

Aplicam-se ao wiring em `backend/src/modules/marketplace` que invoca `orderSagaService` (sobretudo `payment-execution.service.ts`). **Ordem causal validada no código, não assumida** — qualquer refactor que inverta ou condicione mal estes passos pode quebrar compensação (**INFRA-4.2**) muito depois do merge.

### Semântica obrigatória de `paid` na saga

- **`advanceSaga('paid')`** = **dinheiro movido no ledger** (ex.: `bankTransactionService.transfer` concluído com sucesso; movimento persistido de forma auditável para o handler).
- **Não** = estado da tabela de pagamento, `markAsSuccess`, nem efeito secundário posterior usado como **fonte de verdade** para esta transição.
- **Proibição:** alinhar `advanceSaga('paid')` ao repositório de pagamento (“payment row = paid”) **antes** do facto ledger estar fechado — isso convida a compensação ou leitura de `previousStatus` **sem** movimento real no SSOT financeiro.

### Ordem causal mínima (lei operacional)

| Regra | Ordem | Motivo |
|-------|--------|--------|
| Orquestração após persistência | `COMMIT` (pedido + reservas) → `startSaga` | Evita saga “fantasma” e reconciliação incoerente |
| Recurso antes de falha | `releaseReservation` → `failSaga` (ramo de falha **antes** de transfer) | Evita inventário preso / deadlock lógico |
| Ledger antes de `paid` na saga | `transfer` OK → `advanceSaga('paid')` → `markAsSuccess` / resto | Garante compensação só com facto financeiro real; o handler não “inventa” reversão |

`advanceSaga('paid')` **antes** de `markAsSuccess` no código actual **é intencional** e sensível a refactor: **não** mover `paid` da saga para depois de efeitos que não sejam o fecho ledger, nem trocar o gatilho para colunas de pagamento sem rever esta secção e **§INFRA-4** em `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` (tabela *Invariantes de ordem*, v2.8.18).

### Testes sob falha (mínimo viável)

Quando existir suíte de caos / integração dedicada, validar pelo menos:

- **A — Falha após pagamento:** `transfer` OK → falha simulada antes de `markAsSuccess` → saga terminal / `order.saga.failed` → compensação quando houver intenção + UUID → **saldo final consistente**.
- **B — Falha antes do pagamento:** reserva criada → erro antes do `transfer` → `releaseReservation` → `failSaga` → **sem** compensação de escrow.
- **C — Concorrência:** dois intentos de pagamento no mesmo pedido → **um** caminho efectivo → saga consistente → **sem** dupla compensação.

## API de serviço (`orderSagaService`)

Ficheiro: `backend/src/core/sagas/order-saga.service.ts`.

- `startSaga(tenantId, orderId)` — cria linha; emite `order.saga.started`. Falha se já existir saga para o par (tenant, pedido).
- `advanceSaga(tenantId, orderId, target)` — `target`: `'payment_pending' | 'paid' | 'fulfilled'` conforme o estado atual.
- `failSaga(tenantId, orderId, reason)` — estado `failed` + `order.saga.failed` (idempotente se já terminal).
- `timeoutSaga(tenantId, orderId)` — só efetua se `timeout_at < now()` e estado não terminal; emite `order.saga.timeout`.

Timeout por defeito: `ORDER_SAGA_TIMEOUT_MS` (default 3 600 000 ms). Worker: `SAGA_TIMEOUT_WORKER_INTERVAL_MS`, `SAGA_TIMEOUT_WORKER_BATCH`.

## Eventos outbox (idempotência)

| Evento               | Seed / idempotência |
|----------------------|---------------------|
| `order.saga.started` | `order.saga.started:${tenantId}:${orderId}` |
| `order.saga.advanced`| `order.saga:${tenantId}:${orderId}:${newStatus}` |
| `order.saga.failed`  | `order.saga.failed:${tenantId}:${orderId}` |
| `order.saga.compensation.executed` | `saga.compensation:${tenantId}:${orderId}` |
| `order.saga.timeout` | `order.saga.timeout:${tenantId}:${orderId}` |

Função: `outboxEventIdFromSeed` (`event-outbox.repository.ts`).

## Métricas (INFRA-6)

`metric_event` emitidos via logger canónico, agregados como:

- `saga_transition_total`
- `saga_timeout_total`
- `saga_failure_total`
- `saga_compensation_triggered_total` / `saga_compensation_skipped_total` / `saga_compensation_success_total` (INFRA-4.2)

Labels Prometheus: `from_status`, `to_status`, `tenant_id` (sagas); nos skips de compensação, `skip_reason`, `tenant_id`.

**Auditoria / gaps:** se o ledger compensar mas a transação que grava saga + outbox falhar, o log canónico `SAGA_COMPENSATION_PARTIAL_COMMIT` (com `eventId`, `orderId`, `originalTransactionId`, `sagaCompensationPartialCommitPhase`) sinaliza compensação sem fecho auditável na saga — investigar e reconciliar. Idempotência por evento: após sucesso completo, `event_idempotency_tracking` regista `(tenant, event_id, saga.compensation.handler)`; replays do mesmo `event_id` saem cedo sem reexecutar o ledger.

## Endpoints HTTP (prefixo admin, ex. `/admin`)

- `GET /metrics/sagas/summary` — contagens por `status`.
- `GET /metrics/sagas/state?limit=50` — últimas sagas; `?tenantId=` filtra em memória; `?tenantId=&orderId=` devolve uma saga.

## Identificar saga “presa”

1. `GET /metrics/sagas/state?tenantId=<uuid>&orderId=<uuid>`.
2. Verificar `status`, `attempts`, `timeout_at`, `next_retry_at`, `payload`, `metadata`.
3. Correlacionar com `event_outbox` (`event_type` começando por `order.saga.`).

## Reprocessar

- **Avanço manual**: chamar `advanceSaga` com o `target` correcto (apenas se a regra de transição permitir).
- **Evento outbox não publicado**: o worker de outbox retenta; `event_id` determinístico evita duplicar efeitos no `event_log` quando handlers existirem.

## Cancelar manualmente

- **Timeout operacional**: ajustar `timeout_at` no passado e deixar o worker correr, ou invocar `timeoutSaga` (só aplica se o timeout já venceu).
- **Falha de negócio**: `failSaga` com razão auditável.

## Compensação financeira (INFRA-4.1)

Ver também **Compensação automática (controlada)** abaixo (INFRA-4.2).

## Compensação automática (controlada) (INFRA-4.2)

Fluxo: **Saga decide** (intenção no JSON) → **handler executa** (`saga.compensation.handler`) → **ledger** via `compensateTransaction` (imutabilidade do ledger original mantida).

- **`failSaga`** pode receber `options.compensation` com `originalTransactionId` e opcionalmente `enabled` (default `true`). Isto grava em `order_sagas.payload.compensation` o bloco `{ enabled, executed: false, originalTransactionId }` **sem** chamar o ledger. Chamadas a `failSaga` sem esse bloco **não** disparam compensação.
- O handler **`saga.compensation.handler`** escuta `order.saga.failed`. Só compensa se: saga em `failed`, `compensation.enabled === true`, `compensation.executed !== true`, `originalTransactionId` presente, `previousStatus` no evento for `paid` ou `fulfilled`, e a linha em **`bank_transactions`** tiver **`internal_completed_at` preenchido** (liquidação SSOT; equivalente operacional a “completed” antes de chamar o ledger). Depois: `compensateTransaction`, merge de `payload.compensation.executed = true`, e outbox de auditoria `order.saga.compensation.executed` com seed `saga.compensation:${tenantId}:${orderId}` (idempotente; `ON CONFLICT DO NOTHING` no outbox).
- **Transacção SQL:** `compensateTransaction` continua a usar as suas transacções internas (transfer + `ledger_compensations` + outbox do ledger); o handler abre outra transacção só para **atualizar a saga** e **gravar o outbox de auditoria** da saga. Idempotência global: `ledger_compensations` (UNIQUE), flag `executed` na saga, e dedupe do `event_log` para o mesmo `order.saga.failed`.
- **Métricas:** `saga_compensation_triggered_total`, `saga_compensation_skipped_total` (label `skip_reason` nos skips).

Para compensação **manual** ou cenários fora deste fluxo, usar `compensateTransaction` (ver `docs/runbooks/ledger-compensation.md`).
