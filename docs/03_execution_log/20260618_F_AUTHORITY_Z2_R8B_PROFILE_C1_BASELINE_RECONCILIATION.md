# 2026-06-18 — R8B PROFILE-C1 BASELINE RECONCILIATION — hardening + higiene de baseline (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-18, sobre commit material `9ba35d08`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (CLOSED pleno — é reconciliação
> de baseline com prova material, NÃO contenção de rota morta; mas **NÃO** fecha a DT-mãe 0113 nem o parent
> canal-1). Yala confirmou materialmente: diff de 8 arquivos; **zero runtime `.ts` alterado**; zero
> migration/schema; zero frontend; zero Bank/Core/ledger/splits/payout/recovery; zero RBAC/FASE 6; zero
> actor_delegations/R2; não tocou R7b/R8A/social routes; **Caso A confirmado** — os 4 profile-c1 (interest ·
> learning · professional · lifestyle) estão bound no service; rotas derivam subject de `req.user.userId`;
> `actionContext.actorId` é target/hint, não subject; services têm `canRepresentActor(tenantId, userId, actorId)`;
> `resolveActorGuarded` ocorre ANTES dos sinks; lifestyle usa performer server-side sem fallback `?? actorId`;
> guard dedicado material confirmado; baseline reduzido honestamente (**flagged 20→16 · baseline 27→23 · new=0 ·
> service_bound_recognized=4 · stale_baseline=7 inalterado · safe_subject_recognized=6 inalterado**); se a prova
> sumir, o gate FALHA; actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK · arch
> `--strict` critical_new=0 · check:migrations 394/394 · tsc baseline 43; cartório correto; **DT-mãe 0113 e parent
> canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> source); validado estruturalmente pela Yala + executora declarou execução em **pwsh 7 e Windows PowerShell 5.1**.
> **W2** — os E2Es runtime profile-c1 (16/16) e lifestyle (10/10) não foram rodados pela Yala porque NÃO têm runner
> efêmero / `assertEphemeralDb`/`EXPECTED_DATABASE_NAME` (poderiam escrever em unificard_dev); mitigação: este
> commit não altera runtime `.ts`, guard dedicado GREEN, leitura direta de source; **follow-up recomendado: criar
> runner efêmero para esses E2Es em frente própria**. **W3** — working tree sujo fora do material
> (docs/memorias/untracked/artefatos) → não é HOLD_WORKTREE_DIRTY.
>
> **Observação registrada:** `serviceBoundProof()` do detector é GROSSO — verifica a PRESENÇA de `canRepresentActor`
> no arquivo de service, não o ordering before-sink. O ordering rigoroso (gate@ < sink@ por método) vive no guard
> dedicado `audit-profile-c1-actor-binding.mjs` — camada adequada, **não defeito bloqueante**. Seal = docs-only;
> HEAD material permanece `9ba35d08`. _(Detalhe IMPLEMENTED abaixo.)_

Reconciliação do baseline canal-1 do quarteto **profile-c1** (`interest` · `learning` · `professional` ·
`lifestyle`), DECISION-0113 fatia 5.2/5.3 · Z2. **NÃO é frente de produto/financeira/RBAC nem redesenho de
perfil** — é hardening de guard + higiene de baseline com prova material. Hipótese de entrada **CONFIRMADA
(Caso A)**: os 4 já estão bound no service via `resolveActorGuarded`→`canRepresentActor`, mas continuavam no
baseline por o detector ser file-level (a rota casa o canal `actionContext.actorId`; o binding vive no service).

## Anchor / Pré-flight

HEAD inicial `44a9fa31` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8A CLOSED_AS_CONTAINED; DT-mãe 0113 + parent canal-1 OPEN.

## READ-FIRST — prova material dos 4 profile-c1 (Caso A)

Padrão IDÊNTICO nas 4 superfícies:
- **ROTA** (`*.routes.ts`, `requireContext`): SUBJECT = `req.user?.userId` server-side (401 se ausente); TARGET =
  `req.actionContext.actorId` (hint/canal-1); `tenantId`+`actorId`+`userId` threadados ao service. `lifestyle`
  ainda deriva `performedByActorId` server-side (`resolvePerformerActorId`→`findByUserId`, 403 fail-closed), nunca
  o subject como fallback de autoria.
- **SERVICE** (`*.service.ts`, `resolveActorGuarded(tenantId, actorId, userId)`): chama
  `canRepresentActor(tenantId, userId, actorId)` fail-closed (403 sem vazar existência), invocado por **TODA**
  superfície pública ANTES de qualquer sink do repository:
  - interest: getInterestC1 · declareConcept · updateConcept · retireConcept (4).
  - learning: getLearningC1 · declareConcept · updateConcept · retireConcept (4).
  - professional: getProfessionalC1 · updateBio · declareConcept · updateConcept · retireConcept (5).
  - lifestyle: getLifestyle · declareAttribute · retireAttribute (3).

Subject = `req.user.userId` (server-side). Target = `actionContext.actorId` (hint). Spoof cross-actor (userId não
representa actorId) → 403 ANTES do write. Fluxo legítimo (self/representável) → passa. **Nenhum write vivo sem
binding.** Já existiam E2Es de runtime: `validate-pipeline-e2e-profile-c1-authorship.ts` (16 casos) e
`validate-pipeline-e2e-lifestyle-authorship.ts` (10 casos). **Único gap:** o guard `audit-c1-human-journey-closure`
§7 assertava `canRepresentActor` em professional/learning/interest, **mas não em lifestyle**.

## Decisão aplicada: RECONCILE (Caso A)

1. **Guard dedicado** `audit-profile-c1-actor-binding.mjs` (em `validate:regression-guards`): por superfície, exige
   subject `req.user.userId` na rota (e proíbe `userId` como TARGET), `canRepresentActor(tenantId, userId, actorId)`
   no service, e — por método público — `this.resolveActorGuarded(...)` **antes** do primeiro sink do repository
   (gate@ < sink@); lifestyle exige performer server-side (`resolvePerformerActorId`/`findByUserId`) e proíbe
   fallback `performedByActorId ?? actorId`.
2. **Human-journey §7 endurecido**: `lifestyle` adicionado ao loop de `canRepresentActor` (fecha o gap).
3. **Detector `audit-actor-authority-boundary.mjs`**: novo `SERVICE_BOUND_WRITERS` (rota→service) reconhecido com
   **prova cross-file verificada em runtime** (`serviceBoundProof`): a rota deriva subject de `req.user.userId` E o
   service tem `canRepresentActor(tenantId, userId, actorId)`. Os 4 profile-c1 **removidos do BASELINE** e
   reconhecidos. Se a prova sumir (rota deixa de threadar req.user OU service perde canRepresentActor), o arquivo
   volta a flaggar e — fora do baseline — **FALHA** (new>0). Não é mascaramento.
4. **Negative-proof versionado** `negative-proof-profile-c1-actor-binding.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1):
   spoofa o subject no lifestyle (`canRepresentActor(tenantId, userId, actorId)`→`(tenantId, actorId, actorId)`) →
   guard dedicado **FALHA exit 1** → restaura byte-idêntico → git status inalterado → **GATE OK**.

## Baseline canal-1 — antes/depois (honesto, não mascarado)

| | flagged | baseline | new | service_bound_recognized |
|---|---|---|---|---|
| antes | 20 | 27 | 0 | (n/a) |
| depois | 16 | 23 | 0 | 4 |

Os 4 saíram do BASELINE para `SERVICE_BOUND_WRITERS` (recognized) — `new=0` mantido; `stale_baseline=7`
inalterado; `safe_subject_recognized=6` inalterado. GATE OK.

## Prova material — E2Es existentes (runtime)

- `validate-pipeline-e2e-profile-c1-authorship.ts` → **16/16** (professional/learning/interest: ALLOW read self ·
  BLOCK read estranho 403 · BLOCK mutation 403 ANTES do repo · estrutural canRepresentActor/userId threading ·
  non-leak inexistente 403).
- `validate-pipeline-e2e-lifestyle-authorship.ts` → **10/10** (ALLOW read self · BLOCK read estranho 403 · BLOCK
  declare/retire 403 antes de escrever/consentir · anti-forja audit não cresce · non-leak 403 · estrutural
  performer server-side sem `?? actorId`).

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo profile-c1 + human-
journey com lifestyle) · actor-authority-boundary **new=0** (4 recognized; flagged 20→16; baseline 27→23) · arch
`--strict` **critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc
**43** (baseline; nenhum `.ts` de source alterado) · negative-proof bites em pwsh 7 + WPS 5.1.

## Escopo negativo

NÃO tocou R7b/R8A/social routes · Bank/Core/ledger/splits/payout/recovery · RBAC/FASE 6 · actor_delegations/R2 ·
sem migration · sem alteração de schema · sem redesenho de perfil · sem frontend · sem sweep em massa · NÃO removeu
baseline sem guard dedicado · NÃO fecha a DT-mãe 0113 nem o parent canal-1. Nenhum arquivo `.ts` de runtime
alterado — só guards (`.mjs`), `package.json` (wiring) e negative-proof (`.ps1`).

## Estado

**✅ CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-18 sobre commit material `9ba35d08`;
reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W3 + observação serviceBoundProof registrados
como follow-up não-bloqueante — ver bloco SEAL no topo). `profile-c1 baseline reconciliation` →
**CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**. `DT-AUTHORITY-Z2-PROFILE-C1-BASELINE-RECONCILIATION` →
**CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**. **CLOSED pleno (reconciliação provada, não contenção) — mas NÃO
fecha a remediação 0113:** a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e o parent
`DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` permanecem **OPEN** (o parent encolheu de 27→23 entradas, mas
segue aberto). _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do reseal.)_
