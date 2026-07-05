# IA-15 — Logística

> RAIO X READ-ONLY do eixo Logística / execução operacional pós-booking. Insumo, não GO.
> Método: 6 sondas read-only paralelas (ultracode) + corroboração de 1ª mão da espinha (disco vence narrativa).

## 1. Carimbo

* **HEAD:** `aaeb50b5` (full `aaeb50b5182120888a72418775a9d211e33bff4d`), branch `rescue-structural`. _(O prompt citava `dd270f41` — STALE; revalidado de 1ª mão via `git rev-parse`.)_
* **Data/hora:** 2026-06-22 (sessão IA-15 LOGÍSTICA).
* **Git status:** working tree com memórias `M` + muitos `??` (relatórios-irmãos IA-*, pngs, plano de orquestração). NENHUMA mudança de código/migration/schema produzida por esta auditoria.
* **READ-ONLY confirmado:** SIM. Sondas usaram `agentType: Explore` (sem Edit/Write). Única escrita = este arquivo.
* **Arquivo criado/atualizado:** `docs/memorias/IA-15-LOGISTICA.md` (criado).
* **Backend/frontend/schema/docs consultados:** `backend/migrations/*.sql`, `backend/migrations_archive/*.sql` (contexto), `backend/src/modules/{services,presence,events,inventory,marketplace,logistics,rides,subscriptions,bank,evidence}`, `backend/src/core/{authorization,events,availability}`, `frontend/src/{api,components}`, `docs/02_decisions/*`, `REMEDIATION_DT_LOG.md`, relatórios-irmãos `docs/memorias/IA-{10,13,...}.md`.
* **Comandos/probes usados:** `git rev-parse/status`; `rg`/`grep` por ~80 termos operacionais; `Read` de migrations e services-chave; sondas com tentativa de `psql SELECT count(*)` (colunas explícitas, sem `SELECT *`, sem mutação). **Rowcount:** o DEV aparenta **0 linhas** em todo o substrato operacional (`service_orders`, `bookings`, `service_booking_decisions`, `fulfillment_*`, `inventory_*`, `rides_*`, `access_pass_*`) → **nenhum fluxo vivo jamais exercitado**. Por disciplina, **DEV vazio = INCONCLUSIVE para runtime**, não "limpo".

## 2. Escopo

**Auditado (eixo Logística/Operação):** o que acontece DEPOIS de `booking confirmed` — `service_orders` / ordem operacional; status operacional; presença/check-in/check-out/no-show; execução/finalização/comprovação; eventos/audit-trail/append-only; entrega/retirada/devolução; autoridade operacional + body-spoof; e as PONTES (read-only, sem aprofundar) com produto/inventory, locação/recurso, assinatura/entitlement, dinheiro, frontend e cartório.

**Fora de escopo (handoff):** discovery/oferta (IA-OFERTA), tempo/availability completo (IA-TEMPO), identidade/actor (IA-ACTOR), autoridade global (IA-AUTORIDADE), produto/estoque profundo (IA-PRODUTOS-ESTOQUE), locação profunda (IA-LOCACOES-RECURSOS), assinatura profunda (IA-ASSINATURAS-RECORRENCIA), ledger/split/payout/escrow (IA-DINHEIRO), UI completa (IA-FRONTEND-UX-CONTRATOS), cartório (IA-DECISOES-DT). Dinheiro permanece HOLD; toco-o só como raio-X de handoff.

## 3. Mapa macro logístico

```
BOOKING CONFIRMED ........................ FECHA            (Unified Availability SSOT; booking.status checked_in/out = schema morto)
   │  POST /service-orders/confirm-booking (síncrono, decisão humana ACCEPTED; NÃO automático)
   ▼
SERVICE_ORDER (ordem operacional) ........ FECHA            (substrato próprio, NÃO "status no booking")
   │  state machine: draft→confirmed→in_progress→completed | seller_pending→release_approved→funds_released | cancelled
   ▼
RESPONSÁVEL / PROVIDER ................... FECHA            (workerActorId DERIVADO server-side do dono da availability)
   ▼
PRESENÇA / CHECK-IN ..................... FECHA_COM_RISCO   (event_checkins LIVE p/ eventos; presença-de-SERVIÇO ghost/morta)
   ▼
EXECUÇÃO / FINALIZAÇÃO .................. FECHA_COM_RISCO   (complete/buyer-confirm OK; comprovação NÃO-obrigatória; disputa STUB)
   ▼
MATERIAL / INVENTORY / RECURSO ......... FECHA_COM_RISCO   (reserva atômica OK; OUT sem re-lock = INV-03; 0 linhas vivas)
   ▼
ENTREGA / RETIRADA / DEVOLUÇÃO ......... STUB/NÃO_FECHA     (fulfillment skeleton 0 linhas; rental enum-only; rides silado)
   ▼
EVENTO OPERACIONAL ..................... FECHA             (event_outbox/event_log append-only + evidence_packs timeline)
   ▼
HANDOFF DINHEIRO FUTURO ............... HOLD_FINANCEIRO    (release escrow→actor_wallet existe no código mas SEM rota/worker vivo)
```

**Frase-resposta:** o sistema **NÃO para no booking**. Existe ordem operacional material (`service_orders`) com ciclo de vida próprio, autoridade server-side e eventos append-only. Mas a operação é **espinha de serviço**; presença-de-serviço, entrega física, locação e a fiação do dinheiro são **parciais/stub/ausentes**, e **tudo tem 0 linhas vivas** (nunca exercitado em runtime).

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| booking confirmed handoff | FECHA | `service-order.routes.ts:104-158` (POST confirm-booking); `service-order.service.ts:1345-1662` | — | dev 0 linhas (runtime INCONCLUSIVE) | — | FAST-PATH |
| service_order / work_order | FECHA | `20260530555000_…:93-171`; enum draft→…→cancelled | — | — | — | FAST-PATH |
| unicidade por booking | FECHA (parcial) | `20260613150000_…:13-22` UNIQUE WHERE booking_id NOT NULL | — | ordens avulsas booking_id=NULL coexistem (design) | — | FAST-PATH |
| status operacional | FECHA | enum `service_order_status` (8 valores) separado do booking | — | sem `checked_in/no_show/delivered/returned` no enum | — | FAST-PATH |
| presença/check-in | FECHA_COM_RISCO | `event_checkins` LIVE `20260530420000:3`; `checkin.service.ts:24-71` | público (presença-de-serviço) | presença-de-SERVIÇO morta; 9 modelos paralelos | DECISION_PRESENCE_TRUST | DECISION |
| check-out | FECHA_COM_RISCO | `event_checkins.checked_out_*`; booking.checked_out_at morto | — | só eventos; service-booking sem writer | DECISION_PRESENCE_TRUST | DECISION |
| execução/finalização | FECHA | `service-order.service.ts:427` completeOrder; `742-801` buyer-confirm | — | comprovação não-bloqueante | — | FAST-PATH |
| comprovante/evidência | PARCIAL | `evidence_packs` timeline append-only (`evidence.types.ts:8-46`) | — | não exige foto/aceite p/ finalizar | — | MODO B |
| entrega | STUB | `fulfillment_orders` `0107:30-48` (0 linhas); `logistics` skeleton 204 ln | MTP/público (bens) | OUT sem re-lock (INV-03) | MODO_B_DELIVERY_PICKUP | MODO B |
| retirada | NÃO_FECHA | sem entidade de recurso/locação | — | locação=enum | DECISION (rental) | HANDOFF_LOCACOES |
| devolução | NÃO_FECHA | zero tabelas rental_* / return | — | sem modelo retorno | DECISION (rental) | HANDOFF_LOCACOES |
| cancelamento/no-show | PARCIAL | `cancelOrder` `service-order.service.ts:1183`; no-show só `markFailed()` explícito | — | sem no-show automático/penalidade | — | MODO B |
| evento operacional | FECHA | `event_outbox` `20260430130000`; `event_log` `0063` | — | — | — | FAST-PATH |
| audit trail | FECHA | outbox+log+evidence+`bank_ledger`+`order_status_history`(legado orders) | — | service_orders sem status_history dedicado | — | FAST-PATH |
| append-only | FECHA | `0021_ledger_append_only.sql` triggers RAISE; outbox ON CONFLICT DO NOTHING | — | — | — | FAST-PATH |
| autoridade operacional | FECHA | `service-order.routes.ts:68-101` bindOrderWriteActor (5 transições) + `:22-55` assertOrderParty | — | DT-SERVICE-ORDER-AUTHORITY (gate fino service-layer) OPEN MEDIUM | — | MODO B |
| body spoof | RISCO (contido) | write CLOSED 2026-06-16; resíduo `confirmFinancialTerms` `:450-451` (FF 503) | dinheiro (futuro) | spoof financeiro latente atrás de feature-flag | HANDOFF_DINHEIRO | MODO C |
| produto/inventory handoff | FECHA_COM_RISCO | `inventory_movements` SSOT `0102`; reserva `0106` FOR UPDATE | — | INV-03 OUT sem re-lock; 0 linhas | HANDOFF_PRODUTOS | MODO B |
| locação/recurso handoff | NÃO_FECHA | enum `services.service_type='rental'` só; 0 rental_* | — | sem substrato de recurso | HANDOFF_LOCACOES | DECISION |
| assinatura/entitlement handoff | PARCIAL | `access_pass_products`/`actor_access_passes` `20260530562000/563000` | — | sem worker de expiração; subscriptions sem schema | HANDOFF_ASSINATURAS | MODO B |
| dinheiro fora/HOLD | HOLD_FINANCEIRO | release `service-order.service.ts:874-1178` (escrow→actor_wallet) SEM rota/worker | dinheiro | D2-WIRING-MONEY-PENDING | HANDOFF_DINHEIRO | MODO C |
| frontend operacional | PARCIAL (placebo) | só `ServiceOrderFinancialTermsModal.tsx`; transições sem UI | MTP/público | botões de estado/check-in ausentes | HANDOFF_FRONTEND | MODO B |
| testes existentes | INCONCLUSIVE | `work.e2e.spec.ts` (job, não service_order); 0 teste de state machine | — | regressão silenciosa | — | MODO B |

## 5. Achados críticos

### Núcleo da ordem operacional (FECHA)
- **ORDER-01 / EXEC-01 — `service_orders` materializada com ciclo F1/D2/D-money.** Enum `service_order_status` = `draft, confirmed, in_progress, completed, seller_pending, cancelled` (+`release_approved`, `funds_released` por `20260530556000`/`20260530559000`). Colunas: `booking_id`(nullable), `decision_id`(nullable), `service_id`(NOT NULL), `worker_actor_id`, `customer_actor_id`, `service_offering_id`(nullable), `settlement_flow` (`none|fixed_price_escrow`), `scheduled_start`(TIMESTAMPTZ NOT NULL), `buyer_confirmation_deadline_at`, `release_eligible_at`, `disputed_at`, `dispute_id`. Ev: `backend/migrations/20260530555000_create_service_orders_substrate_with_f1.sql:79-171`. **Bloqueia MTP/público/dinheiro: não.**
- **ORDER-02/03 — Integridade booking↔order↔decision.** FK `booking_id→bookings(booking_id) ON DELETE SET NULL` + **UNIQUE parcial** `uidx_service_orders_booking_id WHERE booking_id IS NOT NULL` (anti-duplicidade); FK `decision_id→service_booking_decisions`. Ordens avulsas (`booking_id NULL`) coexistem por design legado. Ev: `20260613150000_booking_order_canonical_binding_integrity.sql:13-27`.
- **ORDER-04/AUTH-LOG-05 — booking confirmed CRIA ordem (síncrono, não automático).** `POST /service-orders/confirm-booking` → `confirmBookingFromDecision`: valida `decision.status=ACCEPTED` → resolve dono da availability (SSOT temporal) → `createOrder(draft)` → `confirmOrder` imediato (confirmed). `workerActorId` é **DERIVADO server-side** do `availability.owner`, nunca do cliente. Ev: `service-order.service.ts:1398-1451`, `service-order.routes.ts:104-158`.
- **ORDER-06/AUTH-LOG-04 — `POST /service-orders` direto DESABILITADO (403 fail-closed).** `SERVICE_ORDER_DIRECT_CREATE_DISABLED` (vetor confused-deputy: body cliente-declarado forjava autoria + DoS na UNIQUE). Ev: `service-order.routes.ts:170-179`; `DT-SERVICE-ORDER-CREATE-DIRECT-AUTHORITY-UNBOUND` (`REMEDIATION_DT_LOG.md:13367`).

### Autoridade operacional (FECHA — reconciliado de 1ª mão)
- **AUTH-LOG-01/02/03 — write-binding + read-binding party-bound.** Todas as 5 transições de escrita (`confirm/start/complete/cancel/buyer-confirm`) passam por `bindOrderWriteActor` (ev. de 1ª mão: `service-order.routes.ts` linhas **256, 280, 305, 343, 367**), que exige: `req.user.userId` REAL (401) + `actionContext.actorId` (400) + actor é PARTE (`customerActorId` OU `workerActorId`, 403 não-leak) + `canRepresentActor` (403). Reads via `assertOrderParty` (`:239, :398`). Lista exige ≥1 filtro de parte representável. `DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF` **CLOSED 2026-06-16** (`REMEDIATION_DT_LOG.md:12118`).
- **CART-04 — `DT-SERVICE-ORDER-AUTHORITY` OPEN/MEDIUM (resíduo fino, service-layer).** Confirmado de 1ª mão (`REMEDIATION_DT_LOG.md:5893-5913`): o gate genérico `authorityService.canPerformAction(actorId,'service_order:complete')` **não cruza** `order.workerActorId === completedByActorId`. **Contido** pelo party-binding de rota (caller já é parte), mas a distinção de papel (worker vs customer vs admin-override) por ação ainda é decisão pendente. **Bloqueia público/dinheiro: parcial** (ator-parte errado poderia completar). Handoff IA-AUTORIDADE/IA-DECISOES-DT.

### Presença (FECHA_COM_RISCO — fragmentada)
- **CHECKIN-01 — `event_checkins` LIVE.** Para EVENTOS (ticket → check-in na janela do evento), com `checked_in_by_actor_id`/`checked_out_by_actor_id` setados server-side. Ev: `20260530420000_events_missing_tables.sql:3-12`, `events/checkin.service.ts:24-71`.
- **PRESENCE-01 / OPERACAO-LOG-02 — presença-de-SERVIÇO é GHOST/MORTA.** O módulo `backend/src/modules/presence/*` (11 rotas) escreve em `checkins`, `checkin_tokens`, `presence_rsvps`, `promo_benefits` — **0 CREATE vigente** (só `migrations_archive`, migrations falharam por FK→`tenants.tenant_id` inexistente). Caller vivo + tabela ausente = **42P01 em runtime**. Ev. de 1ª mão: `presence.repository.ts:60`, `checkin.repository.ts:56`, `checkin-token.repository.ts:61` vs `rg "CREATE TABLE …" = 0 vigente`. Congelado em `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (HIGH, 9 modelos paralelos, espera DECISION-P4).
- **PRESENCE-03 — booking.status `checked_in`/`checked_out` é schema MORTO.** CHECK aceita os valores (`20260530535000_…:93-95`) e `bookings.checked_in_at/checked_out_at` existem (`20260427120000_…:35-51`), mas **nenhum writer** os seta. Elo presença→execução de SERVIÇO não existe.
- **PRESENCE-02 — OperationalCommitment (`event_staff`) FACTUAL/PARCIAL.** `responsible_actor_id` SSOT; transições `expected→checked_in→checked_out→failed` (sem penalidade automática). `CHECK active/inactive/cancelled` do `event_staff` é **incompatível** com `expected/checked_in` (resíduo de modelagem).

### Execução / eventos / dinheiro
- **EXEC-02/03/04 — finalização real.** `completeOrder` bifurca por `settlement_flow`: `none`→`completed`; `fixed_price_escrow`→`seller_pending` (carimba deadline+release_eligible, outbox). `confirmBuyerCompletion` (D2 buyer) e `approveExpiredServiceOrderReleases` (D2 timeout) → `release_approved` (estado-only). Ev: `service-order.service.ts:512-599, 742-801, 803-840`.
- **EXEC-06/09/10/12 — append-only & idempotência.** `event_outbox`(`20260430130000`)+`event_log`(`0063`) com `event_id` SHA-256 determinístico `ON CONFLICT DO NOTHING`; `bank_ledger` triggers BEFORE UPDATE/DELETE RAISE (`0021`); `evidence_packs` timeline append-only; 3 camadas de idempotência (event_id + `WHERE status=X` + `referenceId='order:split'`).
- **EXEC-08 / CART-05 — disputa é STUB.** `disputed_at`/`dispute_id` existem e o release **lê** (`disputed_at IS NULL` guard), mas **não há writer** de abertura/resolução de disputa → ordem pode travar em disputed sem escape. `DT-SERVICE-ORDER-DISPUTE-OPENING` OPEN/MEDIUM.
- **MONEY-LOG-04 / EXEC-05 / ORDER-10 — release move dinheiro mas NÃO está fiado.** `releaseFundsToActorWalletForOrder` (`service-order.service.ts:874-1178`) transfere `escrow_payments→actor_wallet` por split (ledger + payment_intent `escrowed→released_to_actor_wallet` + income-withholding C3.1). **MAS é serviço PRIVADO, sem rota HTTP nem worker vivo** → o caminho operacional só emite outbox; o dinheiro fica em `escrow_payments`. `DT-D2-WIRING-MONEY-PENDING`. **Handoff IA-DINHEIRO.**
- **OPERACAO-LOG-03 / MONEY-LOG-03 — body-spoof residual no financeiro.** `confirmFinancialTerms` (`service-order.routes.ts:450-451`) usa `confirmedByUserId = actionContext.actorId` (não `req.user.userId` real) — **resíduo consciente**, atrás de feature-flag 503 (inalcançável hoje). Precisa binding quando o financeiro sair de 503. **Handoff IA-DINHEIRO/IA-AUTORIDADE.**

### Entrega / inventory / locação / assinatura
- **DELIVERY-01 / FULFILLMENT-INVENTORY-BRIDGE-01 — entrega é skeleton.** `fulfillment_orders`(`0107:30-48`)+`fulfillment_items`(`0108`) com status `PENDING/PICKED/SHIPPED/CANCELLED` e FK inventory; módulo `logistics` ~204 ln sem acoplamento a BD; **0 linhas**. **DELIVERY-02 (INV-03) RISCO:** `fulfillment.service.ts:232-252` grava OUT sem re-`FOR UPDATE` no variant nem revalidar on-hand → negative-stock possível fora da reserva. Handoff IA-PRODUTOS-ESTOQUE.
- **INVENTORY-01 — ponte produto OK.** `inventory_movements` SSOT append-only (`0102` triggers), `inventory_balances` cache reconstruível (`0103`), reserva `inventory_reservations` FOR UPDATE (`0106`). Venda→order→reserva atômica→fulfillment desce OUT.
- **RIDES-01 — `rides_*` LIVE mas silado.** `rides_drivers/vehicles/ride_requests/rides/cities/zones` (`20260530350000+`) + 20 arquivos `modules/rides`; `rides_rides` tem `fare_cents/…/bank_transaction_id`. Ride-hailing de PESSOAS, **não** entrega-de-bens; 0 linhas. Convergência transversal = MACRO 5 (não duplicar). _(Corrige a premissa "greenfield 0 tabelas" do plano de orquestração — ver `MINHA_MEMORIA_LOGISTICA.md`.)_
- **RENTAL-01/RESOURCE-01 — locação NÃO_FECHA.** `service_type='rental'` é enum sem comportamento; 0 tabelas `rental_resources/rental_bookings`; sem owner/status/quantidade/retirada/devolução. DECISION-0109/0110 excluem rental. Handoff IA-LOCACOES-RECURSOS.
- **ASSINATURA-01/02 — entitlement PARCIAL.** `access_pass_products`(`20260530562000`)+`actor_access_passes`(`20260530563000`, `status active/expired/…`) existem (vigência + `commission_override_bps`); **sem worker de expiração** (expiração é só filtro de leitura); `subscriptions` genérica = código sem schema (`to_regclass NULL`). Handoff IA-ASSINATURAS-RECORRENCIA.

### Frontend / testes / cartório
- **FE-LOG-01/02/03 — frontend operacional PLACEBO-PARCIAL.** Único consumer vivo é `ServiceOrderFinancialTermsModal.tsx` (visualizar/aprovar split). Botões de transição (confirm/start/complete/cancel) e telas de check-in/booking **sem UI** (só API client). Handoff IA-FRONTEND-UX-CONTRATOS.
- **TEST-01 — sem testes de state machine.** `work.e2e.spec.ts` cobre job (não service_order); 0 teste de `confirm→start→complete→cancel`/booking/presence/fulfillment.
- **CART-01/02 — DECISIONs CLOSED.** 0121 (binding canônico booking→decision→service_order, e2e 11/11), 0122 (service_offering canônico, e2e 11/11; resíduo `service_id` NOT NULL = `DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING` PARTIAL).
- **CART-03 — DECISION-0146 PROMULGADA docs-only (2026-06-21), PENDING execução.** Integridade temporal da oferta + guard de conflito de booking (overbooking) por `provider_actor_id`. **Não tocou runtime** (HEAD `aaeb50b5` anterior à execução). Handoff IA-TEMPO (F-OFFER-5A/6A, READ-FIRST).
- **CART-08/09 — convergência logística não decidida.** `RFC_UNIFIED_LOGISTICS_MODEL` (rascunho) + `AUDIT_LOGISTICS_DEMAND_CONVERGENCE` (tripla representação DeliveryOrder×ride_request×TransportDemand, veículo decidido em múltiplos lugares). OPEN — alimenta a MACRO 5.

## 6. Gaps de conexão

1. **booking → presença-de-serviço:** booking.status `checked_in/checked_out` existe no schema mas **morto** (sem writer); presença-de-serviço inteira é ghost. O elo "prestador chegou/executou" **não fecha** para serviços (só eventos).
2. **presença → finalização:** `completeOrder` **não depende** de presença (não há gate presença→completion). Worker pode `complete` sem prova de execução. (Coerente com plano §5 MACRO 4, ainda não construída.)
3. **finalização → dinheiro:** o caminho operacional para em outbox/`release_approved`; o transfer `escrow→actor_wallet` existe mas **sem rota/worker** → elo financeiro **não fiado** (D2-WIRING-MONEY-PENDING).
4. **disputa:** release **lê** `disputed_at` mas ninguém **escreve** → deadlock possível; sem fluxo de abertura/resolução operacional.
5. **entrega física ↔ inventory:** ponte existe (reserva→OUT) mas com risco INV-03 (OUT sem re-lock) e 0 linhas vivas; `logistics` é skeleton.
6. **locação:** sem substrato de recurso → retirada/devolução/indisponibilidade inexistentes.
7. **assinatura:** sem worker de expiração → acesso/override não é cortado automaticamente; subscriptions genéricas sem schema.
8. **frontend:** transições e check-in sem UI → operação só via script/Postman (placebo).
9. **demanda física transversal:** DeliveryOrder × ride_request × TransportDemand sem convergência; veículo decidido em múltiplos lugares (alimenta MACRO 5).
10. **autoridade fina:** `service_order:complete` não distingue worker/customer/admin no service-layer (contido na rota, mas não decidido).

## 7. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING** — (sem item direto).
* **IA-PERFIL-SSOT** — (sem item direto).
* **IA-ACTOR** — `workerActorId`/`customerActorId` derivados de actor; `ensureUserActor` em ações materiais (premissa, não auditado aqui).
* **IA-AUTORIDADE** — `DT-SERVICE-ORDER-AUTHORITY` (gate fino `service_order:complete` sem cruzar worker/customer/admin); resíduo de binding em `confirmFinancialTerms`.
* **IA-EMPRESA-PJ** — `canManageCompany` participa de `canRepresentActor` (premissa).
* **IA-SEMANTICA** — (sem item direto).
* **IA-OFERTA** — `service_offering_id` canônico (0122); `RESOURCE-01` (entidade de recurso ausente).
* **IA-TEMPO** — **DECISION-0146** (guard de conflito/overbooking) PENDING execução (F-OFFER-5A/6A, READ-FIRST); `RENTAL-TIME-01`/`RENTAL-CONFLICT-01` (availability sem owner de recurso; `detect_availability_conflicts` SQL stub vazio; capacity não validado).
* **IA-MARKETPLACE-JORNADA** — E2E de fulfillment ausente; jornada pré-booking já provada (B1) por IA-10.
* **IA-COMERCIO-CONTRACT** — `service_booking_decisions` (escolha humana), substrato de pedido/contrato.
* **IA-PRODUTOS-ESTOQUE** — `INV-03` (OUT sem re-lock); ponte reserva↔fulfillment; `inventory_movements` SSOT.
* **IA-LOCACOES-RECURSOS** — locação enum-only; sem `rental_resources` (confirma IA-13: ENUM_ONLY); `DECISION_RENTAL_MODEL`.
* **IA-ASSINATURAS-RECORRENCIA** — `access_pass_*` sem worker de expiração; `subscriptions` sem schema.
* **IA-FRONTEND-UX-CONTRATOS** — UI operacional placebo (só FinancialTermsModal); transições/check-in/booking sem componentes.
* **IA-BANCO** — prova-viva de runtime (rowcounts reais; migrations aplicadas em `schema_migrations`; trigger inventory habilitado; `rides_*` aplicado) — declarei INCONCLUSIVE.
* **IA-DINHEIRO** — `releaseFundsToActorWalletForOrder` (escrow→actor_wallet) sem rota/worker (D2-WIRING-MONEY-PENDING); `confirmFinancialTerms` splits + spoof residual (FF 503); classificação **HOLD_FINANCEIRO**.
* **IA-DECISOES-DT** — `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (DECISION-P4 SSOT de presença); `DT-SERVICE-ORDER-DISPUTE-OPENING`; `DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING`; convergência logística (RFC/AUDIT); `DECISION_RENTAL_MODEL`.

## 8. Riscos para MTP

* **Bloqueia MTP:** (1) **frontend operacional placebo** — sem UI de transições/check-in, a operação não é usável por humano (só script); (2) **presença-de-serviço** ausente p/ a vertical humana (se MTP exigir "prestador executou").
* **Não bloqueia, mas corrigir:** `INV-03` (OUT sem re-lock); disputa sem writer (deadlock); gate fino de autoridade.
* **V2:** entrega física genérica/last-mile; convergência demanda (RFC); rides transversal; subscriptions genéricas.
* **Cleanup:** `event_staff` CHECK incompatível com `expected/checked_in`; booking.status morto; código `presence/*` apontando a tabelas ghost (ocultar rotas, não criar schema próprio).
* **Exige decisão produto/arquitetura:** SSOT de presença (P4); modelo de locação; modelo de demanda física unificada; semântica de no-show/penalidade.

## 9. Riscos para público e dinheiro

* **Blockers antes de público:** UI operacional ausente (placebo); presença-de-serviço ghost; **overbooking** (DECISION-0146 guard não executado — `detect_availability_conflicts` stub, capacity não validado).
* **Blockers antes de dinheiro:** release `escrow→actor_wallet` **sem fiação** (rota/worker) — D2-WIRING-MONEY-PENDING; spoof residual em `confirmFinancialTerms` (binding antes de tirar do 503); disputa sem writer (release pode travar/escapar indevidamente).
* **Blockers operacionais:** disputa não-abrível; no-show não-automático; entrega skeleton.
* **Blockers de presença/trust:** 9 modelos paralelos sem SSOT; sem prova append-only dedicada de presença (audit_service ≠ event-sourcing de presença).
* **Blockers de entrega/retirada:** fulfillment 0 linhas + INV-03; locação sem substrato.
* **Exige DECISION:** SSOT-presença (P4); rental-model; convergência logística; semântica completion↔presença↔dinheiro.
* **Exige MODO C:** completion→money bridge (releaseFunds wiring) — só sob frente financeira própria com as três paralelas + Yala.
* **Permanece HOLD:** todo o release/escrow/split/payout (IA-DINHEIRO); UnifyCard/PSP externo.

## 10. Veredito final

**FECHA_COM_RISCO.**

A pergunta central — *"o sistema para no booking?"* — responde-se **NÃO**: existe ordem operacional material (`service_orders`), com substrato próprio (não "status no booking"), ciclo de vida completo, autoridade server-side party-bound (`bindOrderWriteActor`/`assertOrderParty`/`canRepresentActor`), integridade estrutural (FK + UNIQUE parcial), eventos append-only e ponte de dinheiro desenhada e idempotente. **A espinha de SERVIÇO fecha.** Porém, o eixo como um todo carrega risco material: presença-de-serviço fragmentada/ghost, entrega física skeleton, locação sem substrato, assinatura parcial, disputa stub, fiação do dinheiro não-conectada, frontend operacional placebo, zero testes de state machine, conflito temporal (overbooking) pendente, e **tudo com 0 linhas vivas** (runtime INCONCLUSIVE).

## 11. Próxima frente recomendada

**Primária: `DECISION_PRESENCE_TRUST`** (modo **DECISION**). Justificativa: o elo presença→execução é o gap estrutural do eixo logística que **não é executável-autônomo** — `DT-PRESENCE-FRAGMENTATION-CONFIRMED` tem 9 modelos paralelos (0 rows) e o módulo `presence/*` é ghost; nada deve ser construído antes de Clayton escolher o SSOT de presença (P4) — senão nasce o 10º modelo paralelo. É decisão-primeiro, raiz antes de folha.

**Pré-condições paralelas (handoff, não minha frente):**
- **`HANDOFF_TEMPO`** — executar DECISION-0146 (guard de conflito/overbooking) F-OFFER-5A/6A com READ-FIRST. Blocker de público concreto e já promulgado.
- **`HANDOFF_DINHEIRO` → `MODO_C_COMPLETION_MONEY_BRIDGE`** — fiar `releaseFundsToActorWalletForOrder` (rota/worker) + binding de `confirmFinancialTerms`, só sob frente financeira própria (HOLD até o cofre mandar).
- **`MODO_B_FULFILLMENT_EVENTS`/`MODO_B_DELIVERY_PICKUP`** — corrigir INV-03 e materializar entrega só depois da decisão de modelo (RFC convergência) — V2.

> Eu **filtro/ordeno/sequencio/proponho**; **não cravo** a frente nem disparo mutação. Sistema sugere, humano (Clayton) casa.

## 12. Resumo executivo

* **NÃO para no booking:** `service_orders` é ordem operacional material com ciclo `draft→confirmed→in_progress→completed|seller_pending→release_approved→funds_released|cancelled` (`20260530555000+`).
* **booking→order** é síncrono e autoridade-bound: `confirm-booking` deriva `workerActorId` do dono da availability (SSOT); `POST /service-orders` direto = 403.
* **Autoridade operacional FECHA:** 5 transições via `bindOrderWriteActor` (party + `canRepresentActor`); spoof de escrita CLOSED 2026-06-16. Resíduo: gate fino `service_order:complete` (DT OPEN MEDIUM) + spoof financeiro em FF-503.
* **Eventos append-only FECHA:** `event_outbox`/`event_log` (idempotência SHA-256) + `evidence_packs` + `bank_ledger` triggers.
* **Presença FRAGMENTADA:** `event_checkins` LIVE (eventos); presença-de-SERVIÇO ghost (`presence_rsvps/checkins/checkin_tokens/promo_benefits` 0 CREATE vigente, só archive); booking.status `checked_in/out` morto. 9 modelos paralelos → DECISION-P4.
* **Finalização sem comprovação obrigatória; disputa é STUB** (lê `disputed_at`, não escreve → deadlock possível).
* **Dinheiro HOLD:** release `escrow→actor_wallet` existe no código mas **sem rota/worker** (D2-WIRING-MONEY-PENDING); operação só emite outbox.
* **Entrega/locação:** fulfillment skeleton 0 linhas + risco INV-03; locação enum-only (sem `rental_resources`); rides LIVE mas silado (ride-hailing de pessoas) — corrige "greenfield" do plano.
* **Frontend placebo + zero testes de state machine** (operação só via script).
* **Cartório:** 0121/0122 CLOSED; **0146 PROMULGADA pendente execução** (overbooking guard); convergência logística OPEN (RFC/AUDIT).
* **Tudo 0 linhas vivas** → runtime INCONCLUSIVE; READ-ONLY, nada commitado, nada corrigido.
