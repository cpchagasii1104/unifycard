# LOG DE EXECUÇÃO — FASE 5B — marketplace.service (Offerings / Dispatch Core residual)

**Data:** 2026-02-22  
**Modo:** EXECUTOR  
**Arquivo permitido:** `backend/src/modules/marketplace/marketplace.service.ts`  
**Subcluster:** Offerings / Dispatch Core (Service Offering, Service Request, Dispatch, Provider Radius / Matching, Wait / Hold policies)

---

## OBJETIVO

Eliminar exclusivamente o subcluster Offerings / Dispatch Core residual no `marketplace.service.ts`:

- `offering_id` → `offeringId`
- `request_id` → `requestId`
- `dispatch_id` → `dispatchId`
- `provider_radius_mode` → `providerRadiusMode`
- `min_trust_level_required` → `minTrustLevelRequired`
- `allow_multiple_providers` → `allowMultipleProviders`
- `max_wait_minutes` → `maxWaitMinutes`
- `hold_duration_minutes` → `holdDurationMinutes`

Domínio em camelCase. Sem alteração de lógica, cálculos ou contratos externos.

---

## LINHAS / BLOCOS ALTERADOS (resumo)

- **createServiceRequest:** input `schedule` (maxWaitMinutes, timeWindowMinutes), `constraints` (providerRadiusMode, minTrustLevelRequired, allowMultipleProviders); corpo com `item.offeringId`, validação e construção de `request` em camelCase; remoção de `serviceItemsSnake` e uso direto de `input.serviceItems` em `checkAntiSpam`.
- **listEligibleServiceProviders:** tipo de retorno e array interno com `offeringId`, `eligibilityReason`; usos de `item.offeringId`, `request.constraints.minTrustLevelRequired` / `providerRadiusMode`; `candidates.push` e mapeamento para dispatch com `offeringId` / `eligibilityReason`.
- **sortCandidatesDeterministically:** parâmetro e retorno com `offeringId`, `eligibilityReason`; uso de `request.constraints.providerRadiusMode`.
- **checkAntiSpam:** parâmetro `Array<{ offeringId: string; quantity: number }>` e comparação com `item1.offeringId` / `item2.offeringId`.
- **createServiceBooking:** input e retorno com `offeringId`; objeto armazenado em `serviceBookings` com `offeringId`; todos os call sites atualizados para `offeringId`.
- **serviceBookings / getServiceBooking:** tipo do Map e retorno com `offeringId`.
- **createPreReservation:** input e corpo com `dispatchId`, `requestId`, `offeringId`, `holdDurationMinutes`; call site em `createPreReservationsForDispatch` atualizado.
- **request.request_id → request.requestId** e **request.schedule.max_wait_minutes → maxWaitMinutes** em expiração e visitas.
- **createServiceVisit:** input `dispatchId`; call site com `request.requestId`, `dispatchId`.
- **getProviderDispatchInbox:** tipo de retorno e literal com `dispatchId`, `requestId`; atribuição `request.requestId`.
- **getDispatchStatusForProvider:** tipo de retorno e literal com `dispatchId`.
- **dispatchResponseTimes:** tipo do Map e literal com `dispatchId`.
- **Timeline / logger:** literais de payload e log com `dispatchId` em vez de `dispatch_id`.
- **Candidatos e pré-reservas:** `c.offeringId`, `c.offeringId` em map de candidatos; `b.offeringId`, `confirmedPreReservation.offeringId` em filtros de bookings.
- **getServiceRequestStatus:** retorno com `serviceItems` em vez de `service_items`.
- **Quotes / holds / visits:** `quote.requestId`, `q.requestId`, `input.requestId`, `input.dispatchId`, `s.requestId` onde aplicável.
- **isSlotAvailable:** filtro com `b.offeringId`.
- **confirmServiceBooking:** uso de `booking.offeringId` no order e no retorno.
- **listEligibleServiceProviders:** busca de providers via `entries()` e comparação por chave `offeringKey === item.offeringId` para não depender de `offering_id` no valor do Map.

Não foram alterados: Provider Presence / Metrics (`response_sla_metrics`, `average_response_time_minutes`, `total_dispatches_received`), SLA, Terminal, Plan Limits, Payment Infrastructure, contratos, `marketplace.routes.ts`, seed fora do escopo nominal (apenas usos alinhados onde já em camelCase).

---

## PROPRIEDADES MIGRADAS (domínio)

| Antes (snake_case) | Depois (camelCase) |
|--------------------|---------------------|
| offering_id | offeringId |
| request_id | requestId |
| dispatch_id | dispatchId |
| provider_radius_mode | providerRadiusMode |
| min_trust_level_required | minTrustLevelRequired |
| allow_multiple_providers | allowMultipleProviders |
| max_wait_minutes | maxWaitMinutes |
| hold_duration_minutes | holdDurationMinutes |
| service_items | serviceItems |
| eligibility_reason | eligibilityReason |

Aplicado em: tipos de parâmetros e retornos internos, literais de objetos, acessos a `request`, `schedule`, `constraints`, `item`, `candidate`, `booking`, `dispatch`, `quote`, `input`, e estruturas de dispatch/inbox/status. Nenhum contrato público foi alterado.

---

## TSC — ANTES / DEPOIS

| Métrica | Antes (após FASE 5B Payment Infra) | Depois (após Offerings/Dispatch) |
|---------|-------------------------------------|-----------------------------------|
| **TS2551** | 169 | **121** |
| **TS2339** | 403 | 403 |

- TS2551 **reduzido** em 48 (169 → 121).
- TS2339 **inalterado** (403); nenhum aumento atribuído a este micro-batch.

---

## CONFIRMAÇÕES OBRIGATÓRIAS

- [x] **Nenhum contrato público alterado.**  
  Apenas domínio interno (parâmetros, retornos e literais no service).
- [x] **Nenhum cast (`as`, `any`, `!`) introduzido.**  
  Apenas renomeação nominal e alinhamento a tipos existentes.
- [x] **Nenhuma lógica alterada.**  
  Condições, cálculos, matching e regras de negócio preservados.
- [x] **Nenhum arquivo fora do escopo alterado.**  
  Único arquivo modificado: `backend/src/modules/marketplace/marketplace.service.ts`.

---

## CRITÉRIO DE SUCESSO

- TS2551 **reduzido** de forma significativa (169 → 121).
- **Sem aumento** de TS2339.
- Nenhum erro novo introduzido fora do marketplace por este micro-batch.
- Alteração **apenas nominal** no subcluster Offerings / Dispatch Core.

---

## REGRAS RESPEITADAS

- Domínio em camelCase; contrato externo não alterado.
- Não alterados: marketplace.routes, contratos, SLA, Terminal, Plan Limits, Payment Infrastructure, Provider Presence / Metrics (micro-batch separado).
- Sem novos arquivos; sem refatoração de lógica; sem alteração de cálculos ou estrutura de banco.

Execução FASE 5B — marketplace.service (Offerings / Dispatch Core residual) **concluída** dentro do escopo definido.
