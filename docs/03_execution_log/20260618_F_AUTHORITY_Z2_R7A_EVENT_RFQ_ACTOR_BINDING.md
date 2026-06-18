# 2026-06-18 — R7a EVENT-RFQ ACTING-USER-GATE — AUTHORITY ONLY (material, cirúrgico)

Contenção **authority-only / non-money-runtime** das escritas RFQ W1-W5 (`event-rfq.routes.ts`, DECISION-0113
F6.5.6b / DECISION-0131 §B7 / Z2): criavam/fechavam/cotavam/despachavam RFQ confiando em
`actionContext.actorId` (e no campo FANTASMA `actionContext.actingUserId`, descartado pela middleware) como
autoridade — `if(userId)` no service nunca rodava em produção. Passam a exigir subject server-side
(`req.user.userId`) + representação ANTES do write. **W6 acceptQuote (money-adjacent) é EXPRESSAMENTE FORA do
escopo** (cria availability+booking+service_booking_decision+service_payment_request PENDING — R7b).

## Anchor / Pré-flight

HEAD inicial `bf81c34c` · branch `rescue-structural` · dev 394 · pending=[]. Cadeia `dee733fa`/`037364ca`/
`bf81c34c` presente. Sem sujeira material em events/rfq/authority/action-context/bank/migrations. **Observação
econômica:** R7a pode conter metadata/termos comerciais (`priceCents`/`expectedPriceCents`), mas NÃO materializa
obrigação financeira, NÃO cria payment_request e NÃO toca Bank/ledger/splits.

## Causa-raiz (READ-FIRST — workflow 4 leitores)

- W1-W5 leem `(req as any).actionContext?.actorId` e passam ao sink SEM `canRepresentActor`/`canPerformAction`
  na rota. `actionContext.actingUserId` **não existe** no contrato (`ActionContext = { actorId, intent, source,
  scope }`, middleware lines 154-159) → `if(userId)` em createRFQ/createQuote é dead-path em produção.
- Sinks (service): `createRFQ(tenantId, organizerActorId, input, userId?)` grava `events.metadata.rfqs`;
  `closeRFQ(.., closedByActorId)` muta status no metadata; `createQuote(.., providerActorId, .., userId?)`
  append em `rfq.quotes`; `dispatchRFQToCompanies(.., userId, rfq, companyActorIds)`; `updateEventDeclarationFromSpec
  (.., actorId)` (self-check `actorId===event.actorId`). **Nenhum** escreve Bank.
- Primitivo selado de autoridade do organizer: `assertCanReadEventMoney(tenantId, eventId, callerUserId)`
  (event-visibility.service.ts) resolve `event.actor_id` server-side e exige
  `canRepresentActor(tenantId, callerUserId, organizerActorId)` — já usado por TODAS as leituras RFQ.
- `canRepresentActor(tenantId, userId, actorId)` — primitivo permission-agnóstico, fail-closed.
- **Baseline canal-1 é FILE-LEVEL** (`audit-actor-authority-boundary.mjs`): `event-rfq.routes.ts` é uma única
  chave. W6 acceptQuote permanece unbound → o arquivo DEVE continuar no baseline (remover mascararia W6).

## Correção (cirúrgica — só gate ANTES do sink; service intocado)

Distinção CREATE-as-declared × MUTATE-existing-resource:
- **W1 createRFQ / W3 createQuote** (cria "como" ator declarado): `const callerUserId = req.user?.userId`
  (401 se ausente) → `authorizationService.canRepresentActor(req.tenant.id, callerUserId, actionContext.actorId)`
  (organizer/provider declarado = target/hint) → **403 `EVENT_RFQ_ACTOR_NOT_REPRESENTABLE`** ANTES do sink.
- **W2 close / W4 from-spec / W5 dispatch** (muta recurso do organizer): `assertCanReadEventMoney(tenantId,
  eventId, callerUserId)` — organizer **server-resolved** de `event.actor_id` (NUNCA `actionContext.actorId`
  como fallback) → 404 (não-leak) / 403 `EVENT_RFQ_ACTOR_NOT_REPRESENTABLE` ANTES do sink.
- **Puramente aditivo:** os argumentos passados aos services permanecem inalterados (`actionContext.actorId`
  como atribuição/audit, `actingUserId` mantido) — NÃO se ativa o `canPerformAction` dormente do service; a
  autoridade vive na rota (padrão R6.1/R6.2). Subject soberano = `req.user.userId`.

**W6 acceptQuote intocado:** o handler e a chamada `eventRFQService.acceptQuote(...)` permanecem
materialmente inalterados (nenhum gate de R7a inserido) — provado pelo guard (slice W6 sem
canRepresentActor/assertCanReadEventMoney/403 da frente).

## Baseline canal-1 (file-level — granularidade insuficiente)

`event-rfq.routes.ts` **mantido** no baseline (`audit-actor-authority-boundary.mjs`): a nota foi refinada de
`C1` genérico para `C1_RFQ_W6` — registra que W1-W5 foram vinculadas por R7a (guard próprio) e que **W6
acceptQuote segue UNBOUND + money-adjacent (R7b)**. Como o baseline é file-level e não isola W6, **remover o
arquivo mascararia W6 como resolvido (proibido)** → não removido. Não é BASELINE_GRANULARITY_BLOCKER: o guard
passa com a entrada presente; a granularidade por superfície vive no guard novo `audit-event-rfq-actor-binding`.

## E2E

`run-event-rfq-actor-binding-ephemeral.ps1` → **20/20 verdes** (DB efêmera dedicada
`unificard_event_rfq_actor_binding_e2e`, nunca unificard_dev; HTTP real via `fastify.inject`; evento
public+published de Alice, RFQ semeado no metadata):
- **W1:** A spoof (Bob declara organizer de Alice) → **403** · A2 zero RFQ nova · B legit (Alice) → passa do
  gate (≠403).
- **W3:** C spoof (Bob declara provider de Alice) → **403** · C2 zero quote nova · D legit → passa do gate.
- **W2:** E spoof → **403** · E2 status RFQ inalterado (open) · F legit → fecha · F2 status = closed.
- **W4:** G spoof → **403** (antes de tocar spec/declaration).
- **W5:** H spoof → **403** (zero dispatch).
- **I (não-regressão reads):** I1 read spoof → **403** (reads seguem BOUND) · I2 organizer → 200.
- **K Bank:** bank_ledger+transactions+splits inalterados.
- **J/L guards:** J event-rfq verde (W6 não tocado) · J2 baseline canal-1 verde (W6 não mascarado) · L1 R6.2 ·
  L2 R6.1 · L3 referral.

## Guard + Negative-proof

Novo `scripts/audit-event-rfq-actor-binding.mjs` em `validate:regression-guards`: segmenta os handlers e exige,
por superfície, o gate ANTES do sink (W1/W3 `canRepresentActor(req.tenant.id, callerUserId, actionContext.
actorId)`; W2/W4/W5 `assertCanReadEventMoney(tenantId, eventId, callerUserId)`), subject de `req.user`, código
403 da frente; proíbe `actionContext.actorId/actingUserId` como SUBJECT; **prova que W6 acceptQuote NÃO recebeu
binding de R7a** e segue presente; proíbe `createPaymentRequest`/`service_payment_request(s)`/
`service_payment_executions`/`bank_ledger|transactions|splits` nas rotas RFQ. **Negative-proof versionado**
`scripts/negative-proof-event-rfq-actor-binding.ps1` (ASCII puro, sem BOM, pwsh 7 **e** Windows PowerShell 5.1):
spoofa o subject de W1 (declared actor como subject) → **GATE FAIL (exit 1)** → restaura byte-idêntico → **git
status inalterado** → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
actor-authority-boundary OK (event-rfq mantido no baseline, W6 não mascarado) · arch --strict
**critical_new=0** (warning_new=4 pré-existente: marketplace + e2e scripts, nenhum nas minhas alterações) ·
check:migrations OK (**sem migration**) · tsc baseline **43** — **0 erro novo na frente**.

## Escopo negativo

Sem migration/schema; **W6 acceptQuote / `eventRFQService.acceptQuote` / `createPaymentRequest` /
`service_payment_requests` / `service_payment_executions` intocados**; Bank Core/`bank_ledger`/
`bank_transactions`/`bank_splits` intocados; sem criar payment_request/booking/split; sem refactor de
spec/declaration/produto (só gate antes do sink); R6.2 social-posts, R6.1 services, referral, RBAC/FASE 6,
actor_delegations **intocados**; DT-mãe 0113 **não fechada**.

## Proof-hygiene pós-reseal (sem novo commit; HEAD permaneceu `06349c83`) — W1-W4 follow-up

Reseal Yala material READ-ONLY = **PASS_WITH_WARNINGS** (Yala validou guard + E2E + propriedade material +
diff runtime + W6 exclusion + baseline). Warnings registrados como **follow-up não-bloqueante**:

- **W1 — negative-proof não reexecutado pela Yala:** o script muta `event-rfq.routes.ts` temporariamente,
  incompatível com o mandato READ-ONLY. **Não bloqueia:** a executora o executou em **pwsh 7 e Windows
  PowerShell 5.1** (spoofa subject de W1 → guard FALHA exit 1 → restauração byte-idêntica → git status
  inalterado), e a Yala validou guard + E2E 20/20 + propriedade material.
- **W2 — `assertCanReadEventMoney` como gate de ESCRITA (W2/W4/W5):** materialmente forte hoje — resolve
  `organizerActorId` server-side de `event.actor_id` e chama `canRepresentActor`. Warning de
  nomenclatura/acoplamento: o nome "Read" num gate de write pode enfraquecer silenciosamente se no futuro
  admitir papéis read-only. **Follow-up recomendado:** `assertCanWriteEventRFQ` ou wrapper organizer-only.
  Não bloqueia o selo material.
- **W3 — working tree sujo fora do material:** docs/memorias + planejamento + outputs + pngs; zero arquivo do
  material verificado → não é HOLD_WORKTREE_DIRTY.
- **W4 — carry-over rota legada `/social/posts/create`:** dead-at-db/ungated, já follow-up. Fora desta frente.

**07_NOMENCLATURA:** Yala não encontrou drift novo introduzido pelo commit — `priceCents`/`expectedPriceCents`
são pré-existentes; `actor_system` não foi introduzido como actor_type operacional; `totalCents`-como-contagem
não foi introduzido por esta frente.

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-18 sobre commit material `06349c83`; reseal Yala
material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W4 registrados como follow-up não-bloqueante). dev 394.
`DT-AUTHORITY-Z2-EVENT-RFQ-ACTOR-BINDING-UNBOUND` → **CLOSED / YALA PASS MATERIAL**. **Esta frente corrigiu
somente R7a event-rfq actor binding nas escritas non-money-runtime W1-W5. Não altera acceptQuote, não cria
payment_request, não altera service_payment_requests, não toca Bank/ledger/splits, não mascara W6 no baseline e
não fecha a DT-mãe 0113** — o parent canal-1 `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` e a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` permanecem **OPEN**. W6 acceptQuote e
`eventRFQService.acceptQuote`/`createPaymentRequest`/`service_payment_requests`/`service_payment_executions`/
Bank **não tocados**; nenhum código material alterado no seal. **R7b acceptQuote permanece OPEN / DECISÃO
PENDENTE** (money-adjacent: cria availability + booking + service_booking_decision + service_payment_request
PENDING — exige frente própria antes de qualquer patch). **Continuidade (NÃO executar agora):** R7b acceptQuote
· R6.3 feed-action · rota legada `/social/posts/create` · guard cross-module Z2.
