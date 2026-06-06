# Execução — DECISION-0109 (fundação do Trilho B: serviços) — docs-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `92b82afb` · **Decisão:** Clayton — Op3D (DECISION antes de código) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Cravar a fundação do Trilho B (serviços/agenda/booking) **antes de qualquer código**, após o raio-x read-only que achou três minas: fork de taxonomia, Bank acoplado ao comercial, e frontend em endpoint-fantasma. Docs-only: não toca código/schema/migration/Bank/Op3A.

## Antecedente (raio-x read-only `Op3 READ-ONLY Trilho B`)
- 2 Explore agents (backend writers/endpoints + frontend pages) + probe de banco autoritativo; **discordâncias verificadas** contra o repo vivo (o agente backend superestimou "production-ready"; o banco mostra 0 linhas).
- **Verdade do banco (dev):** `availability` 32 linhas (todas `owner_type='user'`); `services`/`bookings`/`service_orders`/`service_discovery_requests`/`service_booking_decisions` = **0 linhas**; `unified_availability` **inexistente**; categorias `domain`: 16 `servicos` / 15 `marketplace` / 116 null; `salao` default slugs = `marketplace-*` (drift).
- **Bank vivo:** `services-discovery.service.ts:256`, `service-order.service.ts:1072`, `service-payment-execution` (splits).
- **Frontend fantasma:** `ServiceAvailabilityPage`/`ServiceBookingsPage` → `/services/:id/availability`|`/bookings` inexistentes.

## Decisão promulgada (resumo — íntegra em `DECISION_0109`)
- **D1** serviço usa taxonomia `domain='servicos'`. **D2** não reusar a régua 0108 sem bridge. **D3** `company_type` pré-molda serviço só com bridge explícita p/ `domain='servicos'`. **D4** criação+agenda **Bank-free**; booking/order/payment **bloqueados**. **D5** `availability` (core) canônica; sem SSOT paralelo (no máximo adapter fino). **D6** serviço PJ por page-actor/empresa. **D7** piloto **salão**; restaurante **adiado**; peixaria fora. **D8** não confiar no frontend só porque a tela existe.

## Artefatos
- `docs/02_decisions/DECISION_0109_SERVICE_TRACK_B_TAXONOMY_BANKFREE_FOUNDATION.md` (novo).
- `REMEDIATION_DT_LOG.md` — **4 DTs OPEN**: `DT-SERVICE-RAMO-TAXONOMY-FORK`, `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`, `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT`, `DT-SERVICE-NO-COMPANY-RAMO-BRIDGE`.
- `REMEDIATION_DECISIONS_LOG.md` — entrada DECISION-0109.
- `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este log.

## Prova
Docs-only — runtime intocado. 4 gates: actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (363) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). **Migrations 363→363** (zero migration).

## Não-toque confirmado
Nenhum `.ts`/`.sql`/`.mjs` de runtime · Bank (intocado) · `services`/`availability`/`bookings`/`service_orders` (não tocados) · migration/schema (363) · Op3A/booking (não aberto) · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Sequência autorizável (sem execução nesta DECISION — espera Clayton)
1. Esta DECISION (docs-only) — **feita**.
2. `F-SERVICE-TAXONOMY-BRIDGE-READONLY` (read-only) **ou** `F-SERVICE-SALON-BANK-FREE-MVP-DESIGN` (desenho).
3. Caminho **Bank-free**: serviço + availability (salão). Booking/payment depois (decisão financeira própria).
**Critério:** nenhuma fatia comercial/booking/Bank antes das DTs endereçadas + go de Clayton.
