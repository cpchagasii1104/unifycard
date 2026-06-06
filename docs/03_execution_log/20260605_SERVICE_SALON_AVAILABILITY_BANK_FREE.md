# Execução — F-SERVICE-SALON-AVAILABILITY-BANK-FREE (DECISION-0109) — code-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `76c5899b` · **Decisão:** Clayton — agenda Bank-free sobre o core real · **Esteira:** eu (escritora); par verifica.

## Objetivo
Criar a fatia Bank-free de agenda/disponibilidade do serviço de salão, usando o CORE real `availability` (`owner_type='service'`). Reconciliar os endpoints fantasma `/services/:serviceId/availability` como **adapter fino** que delega ao core — sem SSOT paralelo, sem booking, sem Bank.

## READ-FIRST
- `unified-availability.types`: `AvailabilityOwnerType.SERVICE='service'` existe nativamente; `CreateUnifiedAvailabilityInput` exige ownerType/ownerId/start/end.
- `unified-availability.service.createAvailability(tenantId, userId, input)`: valida owner+datas → `repository.create` (`INSERT INTO availability`). **Não** verifica ownership (core genérico/polimórfico) → o adapter precisa validar o serviço.
- Existe `POST /availability` real (core). Frontend `service-availability.ts`/`ServiceAvailabilityPage` chamam `POST/GET/PUT /services/:serviceId/availability` — **fantasma** (não existiam no backend). `unified_availability` **não** é tabela (nome de repo); tabela real = `availability`.
- Services module registrado em `/services`; `Service.actorId`/`serviceId` existem.

## Implementação (code-only, adapter fino)
- **`services.service.ts`:** `requireServiceOwnedByActor` (serviço existe + `service.actorId===callerActorId` senão Forbidden) + 3 métodos:
  - `createServiceAvailability(tenantId, callerActorId, serviceId, input)` → valida dono → `unifiedAvailabilityService.createAvailability(..., {ownerType: SERVICE, ownerId: serviceId, ...input})`.
  - `listServiceAvailabilities(tenantId, serviceId, {status?})` → `listAvailabilities({ownerType: SERVICE, ownerId: serviceId, status})` (leitura pública).
  - `updateServiceAvailability(tenantId, callerActorId, serviceId, availabilityId, input)` → valida dono + que a availability pertence ao serviço → `updateAvailability`.
  - Import do core `unifiedAvailabilityService` + tipos; `ForbiddenError`.
- **`services.routes.ts`:** 3 rotas finas `POST/GET/PUT /:serviceId/availability[/:availabilityId]` (zod parse + `new Date(...)`), projeção `toServiceAvailability` (id=availabilityId, serviceId=ownerId). POST/PUT exigem `actionContext` (dono); GET público.
- **NÃO** cria SSOT paralelo (o core é a verdade), booking, order, payment, Bank, tabela, migration; **NÃO** mexe no frontend (já chamava os paths).

## Prova
- **e2e efêmero `validate-pipeline-e2e-service-salon-availability-bank-free.ts` 10/10 verde:**
  1. serviço de salão válido criado (passa pelo guard de categoria).
  2/3. availability via adapter → **linha no core `availability` com `owner_type='service'`, `owner_id=service_id`**.
  9. adapter delega ao core (list devolve a mesma availability, owner=service).
  escrita=dono: actor não-dono → **ForbiddenError**.
  10. supermercado segue **barrado pelo guard de categoria** (não cria serviço de salão).
  4/5/6/8. **zero booking, zero service_order, Bank intocado**; 1 linha temporal **só no core** (sem SSOT paralelo).
- Backend tsc só baseline geo; **frontend tsc exit 0** (não precisou mudar). 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365** (zero migration).

## DT
- **`DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT` → PARTIALLY MITIGATED** (metade availability reconciliada via adapter→core; metade **bookings** segue fantasma, bloqueada por `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`).
- `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` → OPEN (booking/payment/escrow/settlement seguem atrás da porta corta-fogo do Bank).

## Não-toque confirmado
migration/seed · booking/order/payment/escrow/settlement · Bank · `service_discovery` pay · tabela nova · SSOT paralelo · frontend (não alterado) · restaurante · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Booking/order/payment exigem **decisão financeira** explícita (porta corta-fogo do Bank — `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`). Nada de booking/Bank sem essa decisão. Espera go do Clayton.
