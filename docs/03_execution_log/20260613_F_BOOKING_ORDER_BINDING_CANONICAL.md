# 2026-06-13 — F-BOOKING-ORDER-BINDING-CANONICAL (MODO: EXECUTOR)

Corrige o CONFUSED-DEPUTY / Authority Inversion da cadeia `booking → decision → service_order`:
a autoridade do provedor derivava de `booking.metadata.serviceId` (cliente-declarado) em vez do
dono soberano da availability (SSOT temporal). Parent `23c80ee0` · branch `rescue-structural` ·
dev 378 → **379**.

## Bootstrap normativo (00_AGENT_PROTOCOL §2.2.2)

Lidos: CONSTITUICAO, LEIS_OPERACIONAIS, SSOT_REGISTRY, SSOT_EXCLUSIVE_BANK_RULE, SSOT_CONTRACT,
PROHIBITED_STRUCTURES, LEI_DE_COERENCIA (§4.6–4.9, §7), AUTHORITY_LAW, 08_AUTORIDADE_CANONICA,
AUTHORITY_ENFORCEMENT_MODEL, 15_ACTION_CONTEXT, ACTOR_TRACEABILITY_CONTRACT, AGENDA_UNIVERSAL,
CORE_IMUTAVEL, CORE_TEMPORAL_CONTRACT, 18_DOMAIN_ONTOLOGY, MAPA_CANONICO_PERMISSIONS_v1.
Pilares: AUTORIDADE + TEMPO + ESTADO (FINANCEIRO/SEMÂNTICA intocados). SSOT: Temporal
`unified_availability`; Authority fachada `authority.service` → `authorization.service`/`canActAs`/
`canRepresentActor`. GATE §2.3.2: PASS (jurisdição availability soberana; sem mini-core; fronteira
financeira respeitada).

## Modelo material adotado

`resolveAvailabilityOwner(ownerType, ownerId)` (DECISION-0118 D2) resolve o `authorityActorId`
soberano. Decisão e order: autoria == authorityActor + `canRepresentActor` fail-closed + serviço do
metadata só aceito se pertencer ao dono (409). `worker_actor_id` da order = `owner.authorityActorId`.
`metadata.serviceId` rebaixado a HINT. Ver DECISION-0121.

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `modules/services/service-booking-decision.service.ts` | binding ao dono da availability (autoria+canRepresentActor+consistência de serviço) substitui autoridade-por-metadata |
| `modules/services/service-booking-decision.routes.ts` | catch honra `statusCode` (403/409 propagam; default 400) |
| `modules/services/service-order.service.ts` | `confirmBookingFromDecision`: binding ao dono; `worker_actor_id`/`providerActorId` = dono soberano |
| `modules/services/service-order.routes.ts` | `confirm-booking` passa `req.user.userId` real (era `actionContext.actorId`) + 401 guard |
| `migrations/20260613150000_booking_order_canonical_binding_integrity.sql` | FK booking_id/decision_id + UNIQUE parcial booking_id + FK requester_actor_id (não-financeiro) |
| `scripts/audit-booking-order-authority-binding.mjs` | guard estático (writer lê metadata.serviceId ⇒ exige resolveAvailabilityOwner) + alias + cadeia |
| `scripts/negative-proof-booking-order-authority-binding.ps1` | prova negativa do guard |
| `src/scripts/validate-pipeline-e2e-booking-order-binding-canonical.ts` | e2e adversarial 11/11 |
| `scripts/run-booking-order-binding-canonical-ephemeral.ps1` | wrapper DB efêmera |

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `booking-order-binding-canonical` (DB efêmera, migra FULL 379) | **11/11** |
| T2 confused-deputy (Bob decide slot da Alice) → rejeitado, 0 decisão | ✅ |
| T3 metadata.serviceId alheio ao dono → 409, 0 decisão | ✅ |
| T7 user do Bob declarando-se Alice → rejeitado, 0 decisão | ✅ |
| T1/T8 legítimo: decisão+order; worker = dono soberano | ✅ |
| T-owner worker_actor_id = Alice no banco | ✅ |
| T5 duplicidade order/booking (app + UNIQUE físico) | ✅ |
| T6 FK requester / T-FK FK booking_id | ✅ |
| T4 params.serviceId decorativo (rota não usa) | ✅ |
| T9 Bank intocado | ✅ |
| guard `booking-order-authority-binding` checked=4 failures=0 + prova negativa | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 (actor-authority-boundary 10/10 new=0) · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo nos arquivos tocados |
| migration count | dev 378 → 379 |

## Hard stops respeitados

Zero Bank (`bank_ledger`/`bank_transactions`/`bank_accounts`/splits/payout/refund/reversal); reversal/dispute
containment intactos; RBAC V2/FASE6/R2 não ativados; PJ/cargos/grants/CNAE não tocados; frontend não tocado;
semântica (concept_ref) não tocada; `metadata` não é autoridade.

## Cartório

- DECISION-0121 (`docs/02_decisions/DECISION_0121_BOOKING_ORDER_AUTHORITY_BINDING_CANONICAL.md`) + REMEDIATION_DECISIONS_LOG.
- DT: `DT-BOOKING-ORDER-AUTHORITY-CONFUSED-DEPUTY` → **CLOSED/CONTAINED**; `DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING` → **OPEN** (migração canônica plena p/ service_offering, fatia própria).

## Estado

F-BOOKING-ORDER-BINDING-CANONICAL: **IMPLEMENTED / HOLD PARA RESEAL**.
