# LOG DE EXECUÇÃO — FASE 5B — marketplace.service (Provider Presence / SLA residual)

**Data:** 2026-02-22  
**Modo:** EXECUTOR  
**Arquivo permitido:** `backend/src/modules/marketplace/marketplace.service.ts`  
**Subcluster:** Provider Presence / SLA (métricas de resposta, dispatch, SLA de provider)

---

## OBJETIVO

Eliminar exclusivamente o subcluster Provider Presence / SLA residual no `marketplace.service.ts`:

- `response_sla_metrics` → `responseSlaMetrics`
- `average_response_time_minutes` → `averageResponseTimeMinutes`
- `total_dispatches_received` → `totalDispatchesReceived`
- `total_dispatches_accepted` → `totalDispatchesAccepted`
- `total_dispatches_declined` → `totalDispatchesDeclined`
- `last_response_time_minutes` → `lastResponseTimeMinutes`
- `response_time_minutes` (em `dispatchResponseTimes`) → `responseTimeMinutes`
- `fulfilled_at` (em `slaStatus`) → `fulfillmentTime`
- `dispute_rate` (em literal interno) → `disputeRate`
- `acceptance_rate` (retorno de getProviderResponseSLAMetrics) → `acceptanceRate`

Somente propriedades relacionadas a Provider Presence, SLA Metrics, Response/Dispatch metrics e métricas agregadas internas do domínio. Domínio em camelCase.

---

## LINHAS / BLOCOS ALTERADOS

- **dispatchResponseTimes (tipo):** `response_time_minutes` → `responseTimeMinutes` (linha ~7219).
- **recordDispatchSent:** `presence.response_sla_metrics` → `presence.responseSlaMetrics`; `total_dispatches_received` → `totalDispatchesReceived`.
- **recordDispatchResponse:** `responseTime.response_time_minutes` → `responseTime.responseTimeMinutes`; `presence.response_sla_metrics` → `presence.responseSlaMetrics`; `total_dispatches_accepted` / `total_dispatches_declined` → `totalDispatchesAccepted` / `totalDispatchesDeclined`; `average_response_time_minutes` / `last_response_time_minutes` → `averageResponseTimeMinutes` / `lastResponseTimeMinutes`; filtro e reduce usando `rt.responseTimeMinutes`.
- **recordServiceDispatchResponseEvent:** log key `response_time_minutes` → `responseTimeMinutes`.
- **getProviderResponseSLAMetrics:** tipo de retorno `acceptance_rate` → `acceptanceRate`, `last_response_time_minutes` → `lastResponseTimeMinutes`; corpo: `presence.response_sla_metrics` → `presence.responseSlaMetrics`; leituras de `metrics.*` em camelCase; retorno com `acceptanceRate`, `lastResponseTimeMinutes`.
- **sortCandidatesDeterministically:** `slaMetrics.average_response_time_minutes` → `slaMetrics.averageResponseTimeMinutes`; `slaMetrics.acceptance_rate` → `slaMetrics.acceptanceRate`.
- **checkProviderAbuse:** `slaMetrics.total_dispatches_received` → `slaMetrics.totalDispatchesReceived`; `slaMetrics.acceptance_rate` → `slaMetrics.acceptanceRate`.
- **Penalidades / snapshot (slaStatus):** `latestSnapshot.slaStatus.fulfilled_at` → `latestSnapshot.slaStatus.fulfillmentTime`; literal `sla_violations`: `fulfilled_at` → `fulfillmentTime`, `dispute_rate` → `disputeRate`.

Nenhuma alteração em: Offerings/Dispatch, Payment Infrastructure, Plan Limits, Terminal, Execution/Visit/Quote, contratos, routes.

---

## PROPRIEDADES MIGRADAS (domínio)

| Antes (snake_case) | Depois (camelCase) |
|--------------------|---------------------|
| response_sla_metrics | responseSlaMetrics |
| average_response_time_minutes | averageResponseTimeMinutes |
| total_dispatches_received | totalDispatchesReceived |
| total_dispatches_accepted | totalDispatchesAccepted |
| total_dispatches_declined | totalDispatchesDeclined |
| last_response_time_minutes | lastResponseTimeMinutes |
| response_time_minutes (Map value) | responseTimeMinutes |
| fulfilled_at (slaStatus) | fulfillmentTime |
| dispute_rate (literal) | disputeRate |
| acceptance_rate (retorno) | acceptanceRate |

Contrato `ProviderPresence` (ProviderPresence.contract.ts) já utiliza `responseSlaMetrics` e propriedades em camelCase; apenas o uso no service foi alinhado.

---

## TSC — ANTES / DEPOIS

| Métrica | Antes (após FASE 5B Offerings/Dispatch) | Depois (após Provider/SLA) |
|---------|----------------------------------------|----------------------------|
| **TS2551** | 121 | **110** |
| **TS2339** | 403 | **401** |

- TS2551 **reduzido** (121 → 110).
- TS2339 **reduzido** (403 → 401); nenhum aumento.

---

## CONFIRMAÇÕES OBRIGATÓRIAS

- [x] **Nenhum contrato público alterado.**  
  Apenas uso interno no service; tipo `ProviderPresence` já em camelCase no contrato.
- [x] **Nenhum cast (`as`, `any`, `!`) introduzido.**  
  Apenas renomeação nominal e alinhamento ao tipo.
- [x] **Nenhuma lógica alterada.**  
  Cálculos de SLA, fórmulas, pesos e agregações preservados.
- [x] **Nenhum arquivo fora do escopo alterado.**  
  Único arquivo modificado: `backend/src/modules/marketplace/marketplace.service.ts`.

---

## CRITÉRIO DE SUCESSO

- TS2551 **reduzido**.
- **Sem aumento** de TS2339 (houve redução).
- Nenhuma alteração estrutural; apenas nominal no subcluster Provider Presence / SLA.

---

## REGRAS RESPEITADAS

- Domínio em camelCase; contrato externo não alterado.
- Não alterados: marketplace.routes, Offerings/Dispatch, Payment Infrastructure, Plan Limits, Terminal, Execution/Visit/Quote, contratos.
- Sem novos tipos, sem refatoração de lógica, sem alteração de cálculos ou persistência.

Execução FASE 5B — marketplace.service (Provider Presence / SLA residual) **concluída** dentro do escopo definido.
