# LOG DE EXECUÇÃO — FASE 5B — marketplace.service (Execution / Visit / Quote residual)

**Data:** 2026-02-22  
**Modo:** EXECUTOR  
**Arquivo permitido:** `backend/src/modules/marketplace/marketplace.service.ts`  
**Subcluster:** Execution / Visit / Quote (ServiceRequest, ServiceQuote, ServiceVisit, ServiceExecution, ServicePaymentHold, CompletionSignal)

---

## OBJETIVO

Eliminar exclusivamente o subcluster Execution / Visit / Quote residual no `marketplace.service.ts`:

- `service_value` → `serviceValue`
- `requires_materials` → `requiresMaterials`
- `execution_date` → `executionDate`
- `execution_time` → `executionTime`
- `release_policy` → `releasePolicy`
- `booking_id` (em retornos/quote) → `bookingId`
- `payment_hold_id` → `paymentHoldId`
- `hold_id` → `holdId`
- `dispute_case_id` → `disputeCaseId`

Domínio em camelCase. Sem alteração de lógica, cálculos ou contratos externos.

---

## LINHAS / BLOCOS ALTERADOS

- **createServiceQuote (input):** `execution_date?`, `execution_time?` → `executionDate?`, `executionTime?`; corpo: `input.service_value`, `input.requires_materials`, `input.execution_date`, `input.execution_time` → `input.serviceValue`, `input.requiresMaterials`, `input.executionDate`, `input.executionTime`; literal do quote e logger com `input.serviceValue`.
- **acceptServiceQuote:** retorno e literal: `booking_id` → `bookingId`, `payment_hold_id` → `paymentHoldId`; uso de `quote.executionDate`, `quote.executionTime`; atribuição `quote.bookingId`; logger com `bookingId`.
- **createServicePaymentHold:** logger: `hold_id` → `holdId`, `release_policy` → `releasePolicy`.
- **hold.release_policy:** uso `hold.releasePolicy` em `confirmServiceCompletedByProvider`.
- **confirmServiceCompletedByCustomer / confirmServiceCompletedByProvider:** tipo de retorno `hold_id` → `holdId`.
- **releaseServicePaymentHold:** tipo de retorno e literal `hold_id` → `holdId`; logger `hold_id`, `released_by` → `holdId`, `releasedBy`.
- **disputeService:** tipo de retorno e literal `hold_id` → `holdId`, `dispute_case_id` → `disputeCaseId`; logger com `holdId`, `disputeCaseId`.

Nenhuma alteração em: Payment Infrastructure, Offerings/Dispatch, Provider Presence/SLA, Plan Limits, Terminal, contratos, marketplace.routes.

---

## PROPRIEDADES MIGRADAS (domínio)

| Antes (snake_case) | Depois (camelCase) |
|--------------------|---------------------|
| service_value (input) | serviceValue |
| requires_materials (input) | requiresMaterials |
| execution_date (input/quote) | executionDate |
| execution_time (input/quote) | executionTime |
| release_policy (hold / log) | releasePolicy |
| booking_id (retorno acceptServiceQuote) | bookingId |
| payment_hold_id (retorno) | paymentHoldId |
| hold_id (retorno / log) | holdId |
| dispute_case_id (retorno / log) | disputeCaseId |
| released_by (log) | releasedBy |

Contratos ServiceQuote e ServicePaymentHold já em camelCase; apenas uso interno no service foi alinhado.

---

## TSC — ANTES / DEPOIS

| Métrica | Antes (após FASE 5B Provider/SLA) | Depois (após Execution/Visit/Quote) |
|---------|-----------------------------------|-------------------------------------|
| **TS2551** | 110 | **103** |
| **TS2339** | 401 | 401 |

- TS2551 **reduzido** (110 → 103).
- TS2339 **inalterado** (401).

---

## CONFIRMAÇÕES OBRIGATÓRIAS

- [x] **Nenhum contrato público alterado.**  
  Apenas parâmetros, retornos e literais internos no service; tipos ServiceQuote e ServicePaymentHold já em camelCase nos contratos.
- [x] **Nenhum cast (`as`, `any`, `!`) introduzido.**  
  Apenas renomeação nominal e alinhamento ao tipo.
- [x] **Nenhuma lógica alterada.**  
  Fluxo de execução, regras de visita, cálculos de pagamento e de retenção preservados.
- [x] **Nenhum arquivo fora do escopo alterado.**  
  Único arquivo modificado: `backend/src/modules/marketplace/marketplace.service.ts`.

---

## CRITÉRIO DE SUCESSO

- TS2551 **reduzido** (110 → 103).
- **Sem aumento** de TS2339.
- Nenhuma alteração estrutural; apenas nominal no subcluster Execution / Visit / Quote.

---

## REGRAS RESPEITADAS

- Domínio em camelCase; contrato externo não alterado.
- Não alterados: marketplace.routes, Payment Infrastructure, Offerings/Dispatch, Provider Presence/SLA, Plan Limits, Terminal, contratos.
- Sem novos tipos, sem refatoração de lógica, sem alteração de cálculos ou persistência.

Execução FASE 5B — marketplace.service (Execution / Visit / Quote residual) **concluída** dentro do escopo definido.
