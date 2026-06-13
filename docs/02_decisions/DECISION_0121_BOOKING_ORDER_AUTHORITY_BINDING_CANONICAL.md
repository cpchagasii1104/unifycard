# DECISION-0121 — Authority binding canônico da cadeia booking → decision → service_order

**Status:** PROMULGADA (executada) · **Data:** 2026-06-13 · **Branch:** `rescue-structural` · **Frente:** F-BOOKING-ORDER-BINDING-CANONICAL

**Precedência normativa aplicada:** CONSTITUIÇÃO Art. II (Agenda/Unified Availability = verdade única sobre disponibilidade) > LEIS (5 financeiro intocado, 7 semântico não tocado) > SSOT_REGISTRY (Temporal `unified_availability`; Authority §5.16 fachada `authority.service`) > AUTHORITY_LAW §17 / AUTHORITY_ENFORCEMENT_MODEL §5,§8 / LEI_DE_COERENCIA §4.9.

## Problema (confused-deputy / Authority Inversion)

A cadeia `booking → decision → service_order` derivava a AUTORIDADE do provedor de
`booking.metadata.serviceId` — um valor **cliente-declarado** (HINT, DECISION-0113). Em
`service-booking-decision.service.ts` a decisão validava `service.actorId === decidedByActorId`
com `service` resolvido do metadata; em `service-order.service.ts` o `worker_actor_id` da order
vinha de `service.actorId` (também do metadata). Isto é **Authority Inversion**
(AUTHORITY_ENFORCEMENT_MODEL §5): uma projeção cliente-declarada vencia o SSOT temporal
(`availability.owner_type/owner_id`), violando AUTHORITY_LAW §17 ("autoridade não nasce de
flag/role/status/hint") e a regra "leitura que influencia decisão é autoridade implícita —
proibida" (PROHIBITED_STRUCTURES). Vetor de exploração: reservar o slot de A e decidir/ordenar
declarando o próprio serviço, desviando a order (e o futuro fluxo financeiro) para o atacante.

Além disso: `service_orders.booking_id` sem FK e **sem UNIQUE** (duplicidade de order por booking
possível em corrida); `bookings.requester_actor_id` sem FK; `service_orders.decision_id` sem FK.

## Decisão

1. **Autoridade deriva do DONO SOBERANO da availability**, resolvido server-side pelo primitivo
   canônico `resolveAvailabilityOwner` (`availability-owner-authority.ts`, DECISION-0118 D2) —
   `availability.owner_type/owner_id` → `authorityActorId`. **Nenhum mini-core de autoridade** no
   módulo de services (LEI §4.9.7).
2. **Decisão (`createDecision`)**: (a) `decidedByActorId === owner.authorityActorId` (autoria ==
   authority actor, DECISION-0118 D2); (b) `canRepresentActor(userId, owner.authorityActorId)`
   fail-closed; (c) o `metadata.serviceId` é HINT e **só** é aceite se `service.actorId ===
   owner.authorityActorId` (409 se serviço alheio). O gate de permissão prévio
   `authorityService.canPerformAction('manage_bookings')` é preservado (camada de permissão §4.9).
3. **Order (`confirmBookingFromDecision`)**: mesmo binding; `worker_actor_id = owner.authorityActorId`
   (provedor soberano), nunca `service.actorId` do metadata. A rota `confirm-booking` passa o
   `userId` **real autenticado** (`req.user.userId`), não o `actionContext.actorId` cliente-declarado.
4. **Integridade estrutural não-financeira** (migration `20260613150000`): FK
   `service_orders.booking_id → bookings` (SET NULL) + **UNIQUE parcial** `uidx_service_orders_booking_id`
   (≤1 order por booking) + FK `service_orders.decision_id → service_booking_decisions` (SET NULL) +
   FK `bookings.requester_actor_id → actors` (CASCADE). Materializa no data-layer a jurisdição já
   declarada (DECISION-0021). **Zero Bank** (LEI §4.6–4.7): `service_orders`/`bookings` são tabelas
   operacionais (sem coluna de saldo).

## Fora de escopo (dívida registrada)

`service_orders.service_id` continua FK→`services` (legado). A migração canônica plena para vincular
a order a **`service_offering`** (SSOT comercial/agendável C2, DECISION-0117) fica como
**DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING**. Não se tocou Bank, RBAC V2, FASE 6, R2,
PJ/cargos/grants, frontend, reversal/dispute, semântica (concept_ref).

## Prova

e2e adversarial `validate-pipeline-e2e-booking-order-binding-canonical.ts` (DB efêmera, 11/11):
T2 confused-deputy / T3 metadata spoof (409) / T7 representabilidade / T1+T8 legítimo /
T-owner worker=dono / T5 duplicidade (app+UNIQUE) / T6+T-FK FKs / T4 param decorativo / T9 Bank
intocado. Guard estático `audit-booking-order-authority-binding.mjs` + prova negativa. tsc 25
(baseline arco 0113, zero novo). Gates: actor-writer OK · bank-ledger OK · regression-guards EXIT 0
· arch --strict critical_new=0.
