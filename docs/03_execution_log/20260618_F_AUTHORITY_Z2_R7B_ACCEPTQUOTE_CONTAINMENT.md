# 2026-06-18 — R7b ACCEPTQUOTE P0 CONTAINMENT — HARD-STOP TEMPORÁRIO FAIL-CLOSED (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-18, sobre commit material `34d1421c`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. Yala confirmou
> materialmente: escopo só P0 containment; `event-rfq.service.ts` intocado; sem migration; Bank/workers/RBAC/
> actor_delegations/payout intocados; hard-stop W6 ANTES de `req.tenant`/`actionContext`/params/qualquer `await`;
> retorno **403 `EVENT_RFQ_ACCEPT_QUOTE_CONTAINED`**; sink `eventRFQService.acceptQuote` presente mas
> inalcançável; **E2E efêmero 11/11 rodado pela Yala** (zero writes em events.metadata / availability / bookings /
> service_booking_decisions / service_payment_requests / bank_ledger·transactions·splits); actor-writer-boundaries
> OK · bank-ledger-boundaries OK · regression-guards OK · arch `--strict` critical_new=0 · check:migrations
> 394/394 · tsc baseline 43 zero novo · 07_NOMENCLATURA sem drift; R7a W1-W5 sem regressão; cartório correto; **R7b
> NÃO marcado como remediado pleno; DT-mãe 0113 e parent canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> fonte temporariamente vs mandato READ-ONLY); validado estruturalmente pela Yala + já executado pela executora em
> **pwsh 7 e Windows PowerShell 5.1**. **W2** — o guard prova a presença textual do `return 403`, mas NÃO prova a
> verdade do flag `CONTAINMENT_ACTIVE`; um futuro `= false as boolean` manteria o guard verde (o E2E pegaria) →
> **follow-up opcional de hardening do guard** (ex.: provar `= true`/ausência de `false as boolean`), sem bloquear
> o seal. **W3** — working tree sujo fora do material (docs/memorias/untracked/artefatos) → não é
> HOLD_WORKTREE_DIRTY. Seal = docs-only; HEAD material permanece `34d1421c`. _(Detalhe IMPLEMENTED abaixo.)_

Contenção **P0 temporária / fail-closed** da rota W6 `POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept`
(`event-rfq.routes.ts`, DECISION-0113 / DECISION-0131 §B7 / Z2). **NÃO é o redesenho final** — apenas blinda a
superfície money-adjacent antes de qualquer sink, enquanto o fluxo de confirmação do provider não existe
(depende de DECISION própria). Autorizado por Clayton 2026-06-18 (somente P0 hard-stop, sem remediar o fluxo).

## Anchor / Pré-flight

HEAD inicial `ca3c99a6` · branch `rescue-structural` · dev 394 · migrations 394/394 PASS. R7a EVENT-RFQ
ACTING-USER-GATE **CLOSED / YALA PASS MATERIAL** (W1-W5 bound; material `06349c83` / seal docs-only `ca3c99a6`).
A rota W6 acceptQuote estava **intocada** desde `ca3c99a6` (verificado antes do patch).

## Causa-raiz (auditorias READ-ONLY convergentes: IA-ACTOR-USERS / IA-DINHEIRO / IA-BANCO / IA-DT)

`eventRFQService.acceptQuote(...)` (W6) usa `actionContext.actorId` como **autoridade** (não chama
`canRepresentActor`) e materializa, "em nome do provider", uma cadeia money-adjacent: `events.metadata`
(quote.accepted + RFQ closed) → `createAvailability` → `createBooking` → `createDecision`
(`service_booking_decision` ACCEPTED) → `createPaymentRequest` (`service_payment_request` **PENDING**). Não move
dinheiro (não toca Bank/ledger/splits), mas **fabrica booking/cobrança** sem confirmação do provider, sem
transação única e sem idempotência suficiente. **Regra de produto (Clayton):** aceitar quote = "quero seguir
com esta proposta"; **NÃO** autoriza cobrança; o organizer **NÃO pode emitir cobrança pelo provider** (o
provider/receiver emite, o payer paga). Sem confirmação do provider, **nada material** pode ser criado em P0.

## Correção (cirúrgica — só hard-stop ANTES do sink; service intocado)

No início do handler W6 (antes de qualquer leitura/sink): guard always-on retorna **403** com code
**`EVENT_RFQ_ACCEPT_QUOTE_CONTAINED`** e mensagem `Accept quote is temporarily contained pending provider
confirmation flow.`. O flag é `const CONTAINMENT_ACTIVE = true as boolean` **runtime-widened de propósito** —
mantém o corpo legado abaixo (incl. o sink `eventRFQService.acceptQuote(...)`) **type-checked** (sem TS
unreachable / perda de narrowing → tsc segue no baseline 43) até o redesenho R7b substituí-lo; em runtime é
sempre `true` → 403 fail-closed antes de `req.tenant`, `actionContext`, params ou qualquer `await`. **O sink
permanece como código** (não removido) — preserva o baseline canal-1 e o guard R7a (que exige a presença de
`eventRFQService.acceptQuote(` em W6). Nenhum gate de R7a (canRepresentActor/assertCanReadEventMoney/403
`EVENT_RFQ_ACTOR_NOT_REPRESENTABLE`) foi inserido em W6 — money-adjacent fica para R7b final.

## Prova material — E2E (DB efêmera dedicada)

`run-event-rfq-acceptquote-containment-ephemeral.ps1` → **11/11 verdes** (DB efêmera
`unificard_event_rfq_acceptquote_containment_e2e`, NUNCA unificard_dev; HTTP real via `fastify.inject`; evento
público+published de Alice, RFQ aberto com 1 quote do provider — cenário em que acceptQuote FARIA trabalho
material se executasse):
- **A** organizer legítimo (Alice) accept → **403 `EVENT_RFQ_ACCEPT_QUOTE_CONTAINED`** (contido mesmo p/ organizer).
- **B** spoof (Bob declara organizer de Alice) accept → **403 `EVENT_RFQ_ACCEPT_QUOTE_CONTAINED`**.
- **C** `events.metadata` inalterado (RFQ segue `open`, quote NÃO `accepted`).
- **D** availability count inalterado · **E** bookings count inalterado · **F** service_booking_decisions count
  inalterado · **G** service_payment_requests count inalterado.
- **H** bank_ledger + bank_transactions + bank_splits inalterados.
- **I** guard R7b containment verde · **J** guard R7a actor-binding verde (W1-W5 não tocadas) · **K** baseline
  canal-1 verde (event-rfq mantido).

## Guard + Negative-proof

Novo `scripts/audit-event-rfq-acceptquote-containment.mjs` em `validate:regression-guards`: prova que W6 (a) tem
`return reply.status(403)...EVENT_RFQ_ACCEPT_QUOTE_CONTAINED` ANTES do sink `eventRFQService.acceptQuote(` (gate@
< sink@); (b) o hard-stop precede qualquer `await` (nenhum trabalho material antes); (c) o sink permanece presente
(não pode ser removido — mascararia o estado / quebraria R7a+baseline); (d) a rota W6 NÃO menciona
createAvailability/createBooking/createDecision/createPaymentRequest/service_payment_request(s)/
service_booking_decision(s)/event_outbox/bank_*. **Negative-proof versionado**
`scripts/negative-proof-event-rfq-acceptquote-containment.ps1` (ASCII/sem-BOM; pwsh 7 **e** Windows PowerShell
5.1): defeat do hard-stop trocando `return`→`void` (early-exit vira no-op de fall-through) → **GATE FAIL exit 1**
→ restaura byte-idêntico → **git status inalterado** → **GATE OK**.

## Baseline canal-1 (intocado)

`event-rfq.routes.ts` **permanece** no baseline `audit-actor-authority-boundary.mjs` (NÃO removido — proibido,
mascararia W6 como resolvido). O patch é **baseline-neutral**: flagged=21 / baseline=27 / new=0 / stale_baseline=6
idênticos com e sem a mudança (verificado por stash). O arquivo já figurava em `stale_baseline` desde R7a (o
scanner é file-level e R7a vinculou W1-W5); não é regressão da frente. W6-não-resolvido segue registrado por
(a) entrada no baseline, (b) guard R7a (W6 sem binding), (c) guard R7b (W6 contido, não remediado).

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo R7b) ·
actor-authority-boundary OK (event-rfq mantido; baseline-neutral) · arch `--strict` **critical_new=0**
(warning_new=4 pré-existente: marketplace + e2e scripts, nenhum nos meus arquivos) · check:migrations **394/394**
(sem migration) · tsc **43** (baseline; **0 erro novo na frente**) · negative-proof bites em pwsh 7 + WPS 5.1.

## Escopo negativo

**NÃO** redesenha acceptQuote final; **NÃO** implementa quote-selected / booking-request-pending-provider /
provider-confirmation; **NÃO** cria service_payment_request / booking / availability / decision; **NÃO** toca
Bank / workers / payout / RBAC-FASE 6 / actor_delegations; **NÃO** altera R7a W1-W5; **NÃO** remove
`event-rfq.routes.ts` do baseline canal-1; **NÃO** fecha a DT-mãe 0113 nem o parent baseline canal-1; **sem
migration / sem tabela RFQ/Quote**; não corrige totalCents/type/status; service `event-rfq.service.ts` intocado.

## Estado

**✅ CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-18 sobre commit material
`34d1421c`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W3 registrados como follow-up
não-bloqueante — ver bloco SEAL no topo). `R7b acceptQuote P0` → **CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**.
`DT-AUTHORITY-Z2-EVENT-RFQ-ACCEPTQUOTE-UNBOUND` → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**.
**R7b NÃO está remediado plenamente** — esta é contenção P0; o redesenho final (provider confirmation,
atomicidade, idempotência, criação de estado intermediário) exige **DECISION própria**. DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` permanecem
**OPEN**. _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do reseal.)_

## OPEN / permanece (registro explícito)

- Esta frente é **P0 containment** — não redesenha o fluxo final.
- Não cria payment_request · não cria booking · não toca Bank · não resolve provider confirmation · não resolve
  atomicidade final · não resolve idempotência final.
- Futuro redesenho R7b depende de **DECISION própria** (estado intermediário máximo: quote selecionada ou
  booking-request pending-provider-confirmation — fora desta frente).
