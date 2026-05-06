# Prova operacional — event outbox (INFRA-1)

**Objectivo:** validar retry, DLQ, idempotência, concorrência e entrega após atraso **sem alterar domínio**.

**Implementação:** `backend/tests/integration/event-outbox-infra-prod.integration.test.ts`  
**Comando (com BD migrada e `DATABASE_URL`):**

```bash
cd backend && pnpm test:integration:event-outbox-infra
```

---

## Limitação documentada (comportamento actual)

O `event-outbox.processor` só entra no ramo de **retry/DLQ** quando `eventBus.publish()` **rejeita** (ex.: falha de `event_log`, `tenantId` inválido).

Erros **dentro** de handlers no `event-bus.ts` **não** incrementam `attempts` na `event_outbox` (camada 1). Em paralelo existe **camada 2:** persistência em `event_handler_failures` + worker de retry por `handler_key` (sem novo `publish`) — ver **`docs/runbooks/handler-failures.md`** e teste *PASSO 6* na mesma suíte.

Para simular **só** retry/DLQ da outbox nos testes continua válido `jest.spyOn(eventBus, 'publish').mockRejectedValue(...)` (infra de teste).

---

## Tabela cenário → esperado → resultado

| Cenário | Esperado | Resultado |
| -------- | -------- | ----------- |
| **PASSO 1 — Retry** | 1.ª publicação falha → `attempts = 1`, `next_retry_at` definido, `published_at` NULL. Após `next_retry_at` no passado e novo ciclo → `published_at` preenchido. | `pnpm test:integration:event-outbox-infra` — teste *PASSO 1* |
| **PASSO 2 — DLQ** | Falhas repetidas até `max_attempts` → linha em `event_outbox_failed`, `event_outbox.published_at` preenchido (removida da fila pendente). | idem — *PASSO 2* |
| **PASSO 3 — Idempotência** | Dois `insertEventOutboxRow` com o mesmo `event_id` → uma linha na fila; dois ciclos do processor → handler de prova corre **no máximo uma vez** (`event_log`). | idem — *PASSO 3* |
| **PASSO 4 — Concorrência** | Dois `processEventOutboxCycle()` em paralelo sobre a mesma linha → handler de prova ≤ 1 execução; fila termina com `published_at` definido. | idem — *PASSO 4* |
| **PASSO 5 — Atraso worker** | Linha inserida; um ciclo posterior do processor entrega e preenche `published_at`. | idem — *PASSO 5* |
| **PASSO 6 — Handler retry** | Handler que falha → linha em `event_handler_failures`; após `next_retry_at` no passado, `processHandlerFailureCycle` reinvoca **só** esse `handler_key`. | idem — *PASSO 6* |

Preencha a coluna **Resultado** em ambiente real com: `PASS` / `FAIL` + data após correr o comando.

---

## Pré-requisitos

- `DATABASE_URL` apontando para instância com migrations aplicadas (`event_outbox`, `event_outbox_failed`, `event_log`, `event_handler_failures`, `tenants`).
- Sem necessidade de alterar payloads ou contratos de domínio.

---

## Referências de código

- `backend/src/core/events/event-outbox.processor.ts` — seleção pendente, `publish`, retry (`next_retry_at`), DLQ.
- `backend/src/core/events/event-outbox.repository.ts` — `ON CONFLICT (event_id) DO NOTHING`.
- `backend/src/core/events/event-bus.ts` — `event_log` + idempotência de publish + registo de falhas de handler.
- `backend/src/core/events/handler-failure.processor.ts` — retry por `handler_key` (camada 2).
