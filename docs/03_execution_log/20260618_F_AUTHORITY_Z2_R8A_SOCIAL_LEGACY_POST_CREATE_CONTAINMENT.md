# 2026-06-18 — R8A SOCIAL LEGACY POST-CREATE CONTAINMENT — HARD-STOP FAIL-CLOSED (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-18, sobre commit material `b5afc6bf`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. Yala confirmou
> materialmente: escopo só a rota legada `/social/posts/create` + guard/e2e/proof/docs; sem migration;
> `social.service.ts`/`social.repository.ts`/`social-2.0.routes.ts`/`social-2.0.service.ts` intocados;
> R7b/event-rfq intocados; Bank/Core/ledger/splits/payout/recovery intocados; RBAC/FASE 6 intocado;
> contacts/suppliers intocados; rota legada permanece **registrada**; `POST /social/posts/create` retorna **501
> `SOCIAL_LEGACY_POST_CREATE_CONTAINED`** de forma **incondicional** (sem `await`, sem `req.user`/`tenant`/
> `actionContext`, sem `socialService.createPost`, sem repository/write/outbox); **zero caller vivo** confirmado
> (frontend usa a canônica `POST /social/posts`; orchestrator usa `/marketplace/posts/create`, outro módulo/
> prefixo; testes/e2e não dependem da legada); **dead-at-db** confirmado no source; **E2E efêmero 7/7 rodado pela
> Yala** (legado com/sem actionContext → 501; posts count inalterado; canônica `/social/posts` alcançável e
> ≠501/≠404); guards R8A/R6.2/baseline verdes; actor-writer-boundaries OK · bank-ledger-boundaries OK ·
> regression-guards OK · arch `--strict` critical_new=0 · check:migrations 394/394 · tsc baseline 43; cartório
> correto; **DT-mãe 0113 e parent canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> fonte temporariamente vs mandato READ-ONLY); validado estruturalmente pela Yala + já executado pela executora em
> **pwsh 7 e Windows PowerShell 5.1**. **W2** — o caso E2E **D** prova alcançabilidade + gate de representação
> intacto da canônica, mas **não** prova write canônico bem-sucedido (o ambiente efêmero é negado por RBAC
> `publish_feed`); a intactness é sustentada por not-in-diff + guard + alcançabilidade. **W3** — working tree sujo
> fora do material (docs/memorias/untracked/artefatos) → não é HOLD_WORKTREE_DIRTY.
>
> **Observação registrada (fora do escopo R8A):** `social-group.service.ts` ainda chama o método interno
> `socialService.createPost`, porém com autoridade `globalUserId` **server-side** (não `actionContext`) — caller
> interno confiável, **não** é regressão desta frente. Follow-up possível: retirada futura do método legado
> interno `socialService.createPost`, sem tratar como regressão de R8A. Seal = docs-only; HEAD material permanece
> `b5afc6bf`. _(Detalhe IMPLEMENTED abaixo.)_

Contenção **fail-closed (501 nomeado)** da rota LEGADA `POST /social/posts/create` (`modules/social/social.routes.ts`,
montada no prefixo `/social` via `socialModule`), DECISION-0113 / DECISION-0131 §B7 / Z2. Decisão **A) CONTER**
(não BIND, não religar) após READ-FIRST provar **zero caller vivo + dead-at-db**. A superfície viva é a canônica
`POST /social/posts` (`social-2.0.routes.ts`), já vinculada por R6.2 — **intacta**.

## Anchor / Pré-flight

HEAD inicial `8309c52a` · branch `rescue-structural` · dev 394 · migrations 394/394 PASS. Working tree material
limpo (apenas docs/memorias + untracked `r8_recovered.json` e artefatos — fora do material). R7b acceptQuote
**CLOSED_AS_CONTAINED** (não reaberto).

## READ-FIRST — Evidence Pack (prova de uso vivo / decisão A vs B)

**Causa-raiz (Z2/0113):** o handler legado (`social.routes.ts:86-117` antes do patch) passava
`req.actionContext.actorId` **direto** como autor (param `globalUserId`) a `socialService.createPost`
(`social.service.ts:22`) → `SocialRepository.create` (`social.repository.ts:26`), **sem `canRepresentActor`** em
parte alguma (actionContext.actorId = hint, nunca autoridade).

**Prova ZERO-CALLER (decisão A):**
- **Frontend:** usa a canônica `POST /social/posts` (`frontend/src/api/social-2.0.ts:215`) — **nunca**
  `/social/posts/create`. `rg "/social/posts/create"` no frontend = 0 hits de código.
- **Orchestrator:** `orchestrator.service.ts:33` e `orchestrator.ai.ts:229` apontam para `/marketplace/posts/create`
  (outro módulo/prefixo) — **não** é a rota social legada.
- **Testes/e2e:** `rg "posts/create"` em `**/*.{test,spec,e2e}` = **0 matches**. O e2e R6.2
  (`validate-pipeline-e2e-social-posts-actor-binding`) exercita a CANÔNICA (`social2Routes`), não a legada.
- **String literal:** `/social/posts/create` só aparece em docs + `r8_recovered.json` (artefato de auditoria) —
  **0 caller de código**.

**Prova DEAD-AT-DB:** o `SocialRepository.create` faz `INSERT INTO posts (tenant_id, global_user_id, content,
type, visibility, media, intent, confidence, categories, suggested_actions, metadata, event_id) ... RETURNING
post_id, ...`. O schema **vivo** de `posts` (writers canônicos: `social-2.0.service.ts:763`, `votes.service.ts:147`,
`event-feed.handlers.ts:109`, `seed-test-ecosystem.ts:512`, e2e unread-counts) usa `id` (PK), `actor_id`,
`post_type`, `intent_metadata`, `targeting`, `is_published/is_deleted` — e **não** tem
`type`/`visibility`/`confidence`/`categories`/`suggested_actions`/`event_id`/`post_id`. `visibility` é coluna
**fantasma** confirmada (`social.routes.ts:260-261` + `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN`). Logo o
INSERT legado **lança no DB e nada persiste** → a rota nunca cria post.

**Decisão recomendada e aplicada: A) CONTER.** Caller vivo = 0; rota dead-at-db; ungated-authority. Não há produto
a preservar (a canônica já é a superfície viva) → conter fail-closed é o ato honesto; **não** bindar rota morta só
para preservá-la, **não** redesenhar.

**Blast radius:** nulo para clientes (ninguém chama a rota); a canônica é intocada; demais rotas de
`social.routes.ts` (`GET /posts/:postId`, `GET /unread-counts`) preservadas.

## Correção (cirúrgica — hard-stop ANTES de qualquer sink)

No handler `POST /posts/create`: **501** com code **`SOCIAL_LEGACY_POST_CREATE_CONTAINED`** (msg honesta: "Legacy
endpoint retired. Use the canonical POST /social/posts (social 2.0)."). Removidos do handler: a chamada
`socialService.createPost`, o uso de `req.actionContext.actorId` e a validação `createPostSchema.parse`; imports
agora-órfãos `CreatePostInput` + `createPostSchema` removidos (`socialService` permanece — usado por `getPost`). A
rota **permanece registrada** (não removida — baseline canal-1).

## Prova material — E2E (DB efêmera dedicada)

`run-social-legacy-post-create-containment-ephemeral.ps1` → **7/7 verdes** (DB efêmera
`unificard_social_legacy_post_create_containment_e2e`, NUNCA unificard_dev; HTTP real via `fastify.inject`;
registra legado + canônica sob `/social`):
- **A** POST legado (com actionContext) → **501 `SOCIAL_LEGACY_POST_CREATE_CONTAINED`**.
- **B** POST legado (sem actionContext) → **501** (contenção incondicional, antes de gate/sink).
- **C** posts count inalterado (zero write).
- **D** canônica `POST /social/posts` (self-actor) **INTACTA** (≠501, ≠404, code ≠ `SOCIAL_POST_ACTOR_NOT_REPRESENTABLE`;
  alcança o handler, passa a representação e é negada adiante por `publish_feed`/RBAC — prova que não foi contida).
- **E** guard R8A verde · **F** guard R6.2 (canônica) verde · **G** baseline canal-1 verde.

## Guard + Negative-proof

Novo `scripts/audit-social-legacy-post-create-containment.mjs` em `validate:regression-guards`: exige no handler
`/posts/create` o `return reply.status(501)` com code `SOCIAL_LEGACY_POST_CREATE_CONTAINED`; **proíbe**
`socialService.createPost(` e `actionContext` na rota contida; e prova a **canônica intacta** (`social-2.0.routes.ts`
mantém `social2Service.createPost`, `canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id)` e
`SOCIAL_POST_ACTOR_NOT_REPRESENTABLE`). **Negative-proof versionado**
`scripts/negative-proof-social-legacy-post-create-containment.ps1` (ASCII/sem-BOM, pwsh 7 **e** Windows PowerShell
5.1): reintroduz o write sink + `actionContext` antes do 501 → **GATE FAIL exit 1** → restaura byte-idêntico →
**git status inalterado** → **GATE OK**.

## Baseline canal-1

`social.routes.ts` **permanece** no baseline `audit-actor-authority-boundary.mjs` (nota `C1`; NÃO removido). Após a
contenção o arquivo deixou de casar a violação client-declared → moveu de `flagged` para `stale_baseline`
(flagged 21→20, stale 6→7, **new=0**, GATE OK) — mesmo comportamento informativo do event-rfq pós-R7a; a entrada é
mantida e o **parent canal-1 segue OPEN**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo R8A) ·
actor-authority-boundary OK (social.routes mantido; new=0) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente: marketplace + e2e scripts, nenhum nos meus arquivos) · check:migrations **394/394** (sem migration) ·
tsc **43** (baseline; **0 erro novo na frente**) · negative-proof bites em pwsh 7 + WPS 5.1.

## Escopo negativo

NÃO tocou R7b/event-rfq · NÃO tocou Bank/Core/ledger/splits/payout/recovery · NÃO ativou RBAC/FASE 6 · sem
migration · NÃO tocou contacts/suppliers · NÃO criou rota nova · NÃO removeu a rota (contida, registrada) · NÃO
alterou a canônica `social-2.0` · NÃO decidiu produto no chute (decisão A provada por zero-caller + dead-at-db) ·
NÃO fecha a DT-mãe 0113 nem o parent canal-1.

## Estado

**✅ CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-18 sobre commit material
`b5afc6bf`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W3 + observação social-group
registrados como follow-up não-bloqueante — ver bloco SEAL no topo). `R8A /social/posts/create legacy` →
**CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. `DT-AUTHORITY-Z2-SOCIAL-LEGACY-POST-CREATE-UNBOUND` →
**CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. **Não fecha remediação plena:** a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e o parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN**. _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do reseal.)_
