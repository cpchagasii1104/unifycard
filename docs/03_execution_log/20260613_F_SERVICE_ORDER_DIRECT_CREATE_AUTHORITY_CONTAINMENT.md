# 2026-06-13 — F-SERVICE-ORDER-DIRECT-CREATE-AUTHORITY-CONTAINMENT (MODO: EXECUTOR)

Contém o vetor IRMÃO do confused-deputy achado no reseal de F-BOOKING-ORDER-BINDING-CANONICAL: a
criação DIRETA de service_order via `POST /service-orders` (`serviceOrderService.createOrder`)
aceitava worker/customer/booking/decision/service do BODY cliente-declarado, sem binding ao dono
soberano da availability. Parent `46212880` · branch `rescue-structural` · dev **379** · **sem migration**.

## Causa (P1)

`serviceOrderService.createOrder` (caller único: `service-order.routes.ts` `POST /service-orders`)
inseria a order com `workerActorId`/`customerActorId`/`bookingId`/`decisionId`/`serviceId` do body,
sem `resolveAvailabilityOwner`/`canRepresentActor` e sem exigir decisão ACCEPTED. Com a UNIQUE
parcial `uidx_service_orders_booking_id`, permitia order `draft` sobre o booking de outro (worker
spoofado) e/ou ocupar o slot bloqueando `confirmBookingFromDecision` (DoS).

## Contenção (edge HTTP, fail-closed)

Handler `POST /service-orders` reduzido ao **`403 SERVICE_ORDER_DIRECT_CREATE_DISABLED`** ("Direct
service order creation through HTTP is disabled until authority binding is implemented. Use the
booking decision flow.") como ÚNICA instrução — sem caminho (alcançável ou morto) que chame
`serviceOrderService.createOrder` (lição do reseal anterior: zero dead code). O método de serviço
permanece dormente (sem caller HTTP). `POST /service-orders/confirm-booking`
(`confirmBookingFromDecision`, binding ao dono) **intacto**. Não se usou requireRole/requirePermission;
binding definitivo não implementado.

## Guard / prova negativa

`audit-booking-order-authority-binding.mjs` ganhou check: `service-order.routes.ts` não pode chamar
`serviceOrderService.createOrder` (checked=5/0). Prova negativa fase 2 injeta a re-exposição na rota
(backup `.bak`) → guard FALHA → restaura → verde.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `service-order-direct-create-containment` (DB efêmera, Fastify inject + service-layer) | **8/8** |
| T1 POST /service-orders → 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED | ✅ |
| T2 bookingId inexistente → 403 (não 404/validação: createOrder não alcançado) | ✅ |
| T3 zero service_order pela rota bloqueada | ✅ |
| T4 fluxo canônico confirmBookingFromDecision intacto (worker=dono) | ✅ |
| T5 duplicidade canônica segue bloqueada | ✅ |
| T6 Bank intocado | ✅ |
| T7 dispute/reversal containment intactos (403 codes preservados) | ✅ |
| Guard booking-order-authority-binding checked=5/0 + prova negativa dupla | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo em service-order.routes |
| migration count | 379 (inalterado — sem migration) |

## Hard stops respeitados

Zero Bank; sem migration; `confirmBookingFromDecision`/migration `20260613150000` não alterados;
reversal/dispute containment intactos; RBAC V2/FASE6/R2/PJ/CNAE/frontend não tocados; sem `SELECT *`/devLog.

## Cartório

- `DT-SERVICE-ORDER-CREATE-DIRECT-AUTHORITY-UNBOUND`: **OPEN / P1 CONTAINED**.
- `DT-BOOKING-ORDER-AUTHORITY-CONFUSED-DEPUTY`: classe **CONTAINED** (ambas as superfícies fail-closed).
- F-BOOKING-ORDER-BINDING-CANONICAL: **PARTIAL → CLOSED** (pendente reseal desta contenção).

## Estado

F-SERVICE-ORDER-DIRECT-CREATE-AUTHORITY-CONTAINMENT: **IMPLEMENTED / HOLD PARA RESEAL**.
