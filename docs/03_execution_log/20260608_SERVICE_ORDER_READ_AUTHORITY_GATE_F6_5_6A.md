# Execução — F-SERVICE-ORDER-READ-AUTHORITY-GATE-F6_5_6A (DECISION-0113 fatia 6.5.6a) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `c244ce59`
**Decisor:** Clayton (GO F6.5.6a; subfatiado — só service-order reads) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Ler ordem comercial só se o caller for parte legítima (ou puder representar o actor parte). Sem tocar events (6.5.6b) nem os writes.

## READ-FIRST (5 perguntas do GO)
1. **Dono real:** DUAS partes — `customerActorId` (comprador) e `workerActorId` (prestador). Não há dono único → modelo de **participante**.
2. **Campos:** `service-order.types.ts:65-66` (`workerActorId`+`customerActorId`); `workerActorId = service.actorId`, `customerActorId = booking.requesterActorId` (`service.ts:1483-1484`). Origem: `bookingId` via confirm-booking.
3. **Regra já no write:** SIM — `buyer-confirm` valida `order.customerActorId === input.buyerActorId` (`service.ts:771`). Reaproveitada.
4. **GET /:id:** privado (transação comercial entre partes).
5. **Anti-IDOR:** resolve a ordem → `actionContext.actorId` representável deve ser parte → senão 403.
→ Modelo claro → **sem STOP**.

## Implementação (backend; 1 arquivo; sem Bank/migration/frontend/write)
Helper `assertOrderParty(req, reply, tenantId, order)`: `req.user.userId` ausente → 401; `actionContext.actorId` ausente → 400; ordem null **ou** `actorId ∉ {customerActorId, workerActorId}` → **403 não-leak**; `canRepresentActor(userId, actorId)` false → 403.
- `GET /service-orders/:id`: `getOrderById` → `assertOrderParty`; ordem inexistente → 403 (404 removido).
- `GET /:id/financial-terms`: `getOrderById` → `assertOrderParty` → `getFinancialTerms`.
- `GET /service-orders` (lista): exige ≥1 filtro de parte (`workerActorId`|`customerActorId`); todo filtro de parte presente deve ser **representável**; sem filtro de parte → 403 (não lista o tenant inteiro).
- **Writes intocados** (confirm/start/complete/buyer-confirm/cancel/confirm-financial-terms) — handlers separados; o write-spoof `confirmedBy/startedBy = actionContext.actorId` fica em `DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF` (READ-FIRST confirmou read≠write no mesmo handler → não corrigir junto, regra Clayton).

## Padrão de gate (classificação F6.5.0)
- service-order reads = **OWN-PARAMS por participante** (`canRepresentActor` + parte `customer`/`worker`); lista = escopo forçado a party-filter representável.

## Prova
- **e2e novo** `validate-pipeline-e2e-service-order-read-authority-f6-5-6a` **11/11**: **A** behavioral primitivo nega cross-user; **B** `getOrderById(random) → null` (DB real) → caminho não-leak + predicado de parte com valores concretos (devActor é parte / estranho não); **party-lê-ordem-REAL N/A — 0 `service_orders` em DEV** (tabela existe/vazia, como thread; reportado, não fake-green); **C** estrutural gate-antes-da-leitura nos 3 + lista escopada + não-leak 404→403 + writes intocados.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**).
- **Núcleo 0113 + F6.5.1–5 intactos:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7 · contextual-thread-f6-5-3 8/8 · feed-f6-5-4 8/8 · company-members-f6-5-5 7/7.

## O que NÃO foi tocado
Writes de service-order (write-spoof → DT própria) · events (6.5.6b) · ledger · inbox · commitments · contextual-thread · feed · dashboard/reports · R2 · Bank · migration · frontend.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` OPEN (6.5.6a fechada). DT-mãe OPEN.

## Próximo passo (espera go)
**F6.5.6b — events** (classificar **público × private × unlisted** ANTES de gatear; private/unlisted não pode virar leak nem gatear o público).
