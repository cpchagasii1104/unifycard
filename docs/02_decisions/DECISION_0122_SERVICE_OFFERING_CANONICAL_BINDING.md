# DECISION-0122 — service_offering como recurso canônico da cadeia decision/order

**Status:** PROMULGADA (executada) · **Data:** 2026-06-13 · **Branch:** `rescue-structural` · **Frente:** F-SERVICE-OFFERING-CANONICAL-BINDING

**Precedência:** CONSTITUIÇÃO Art. II (Unified Availability = verdade temporal) > LEIS (4 estrutura prevalece; 5 financeiro intocado) > SSOT_REGISTRY (C2 oferta/serviços = `service_offerings`; Temporal `unified_availability`) > DECISION-0117 (service_offering, canonical_services) / DECISION-0118 D2 (owner polimórfico) / DECISION-0121 (binding ao dono).

## Contexto provado (READ-FIRST)

- `service_offerings.provider_actor_id` é **sempre** o provider soberano; `canonical_service_id` sempre presente; **`service_id` NUNCA é populado na criação** (sempre NULL — DECISION-0117: vínculo é via `canonical_service_id`, não via service legado).
- `availability.owner_type='service_offering'` (criado por `declareAvailability`) já resolve autoridade → `provider_actor_id` via `resolveAvailabilityOwner` (DECISION-0118 D2).
- `service_orders.service_id` é **NOT NULL** e **não pode** virar nullable (Lei 4). `service_orders`/`service_booking_decisions` **não tinham** coluna para a oferta.
- Zero readers de `service_orders.service_id` em marketplace/discovery (todos no módulo services). Todas as tabelas envolvidas rows=0 → sem backfill.

## Decisão

1. **A OFERTA é o recurso comercial/agendável canônico** da cadeia quando a availability é
   `owner_type='service_offering'`. Materializada por nova coluna **NULLABLE** `service_offering_id`
   (FK→`service_offerings`, ON DELETE SET NULL) em `service_booking_decisions` e `service_orders`
   (migration `20260613160000`, não-financeira, índices parciais de descoberta).
2. **Origem soberana:** `service_offering_id` é gravado a partir do **SSOT availability**
   (`availability.ownerId` quando `ownerType='service_offering'`), **NUNCA** do cliente/metadata.
   O valor derivado **sobrescreve** qualquer `serviceOfferingId` que o cliente declare.
3. **provider/worker** continua resolvido por `resolveAvailabilityOwner` (= `provider_actor_id`);
   autoria == authorityActor + `canRepresentActor` (DECISION-0121) preservados.
4. **`service_id` permanece legado/projeção** (NOT NULL, Lei 4) — sourced de `metadata.serviceId`
   validado contra o MESMO provider soberano (`service.actorId === owner.authorityActorId`). NÃO é
   autoridade. Anti-divergência: se a oferta carregar `service_id` próprio, `metadata.serviceId` não
   pode contradizê-lo (409).
5. **Caminho único de criação** segue `confirmBookingFromDecision`; `POST /service-orders` permanece
   **403** (DECISION/F-SERVICE-ORDER-DIRECT-CREATE-AUTHORITY-CONTAINMENT) — NÃO reaberto.

## Resíduo (dívida) — DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING → PARTIAL/CONTAINED

A oferta agora é **materialmente registrada** (canônica) na decision/order, mas `service_id` segue
NOT NULL obrigatório (toda order ainda carrega um service legado). A **eliminação** de `service_id`
para ofertas sem service de apoio exige `service_orders.service_id` nullable (mudança estrutural,
Lei 4) + decisão de produto + caminho que popule `service_offerings.service_id` (hoje inexistente).
Fora desta frente.

## Prova

e2e `validate-pipeline-e2e-service-offering-canonical-binding.ts` (DB efêmera, **11/11**): T1/T6
legítimo (order+decision com `service_offering_id`=oferta do SSOT, worker=provider) · T2 confused-deputy
oferta · T3 service_id legado alheio (409) · T4 metadata.serviceOfferingId spoof IGNORADO · T5 provider
mismatch · T6b service_id projeção preservado · T7 duplicidade · T8 POST /service-orders 403 · T9
dispute containment · T10 Bank intocado. Guard `audit-booking-order-authority-binding.mjs` (offering
de fonte cliente proibido) + prova negativa tripla. tsc 25 (baseline, zero novo). Gates verdes. dev 380.
