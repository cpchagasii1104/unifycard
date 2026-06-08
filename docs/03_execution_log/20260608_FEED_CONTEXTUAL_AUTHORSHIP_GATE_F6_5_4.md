# Execução — F-FEED-CONTEXTUAL-AUTHORSHIP-GATE-F6_5_4 (DECISION-0113 fatia 6.5.4) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `cb426925`
**Decisor:** Clayton (GO F6.5.4 + cobrança de behavioral REAL) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Impedir que um caller declare o `actorId` de outro e leia o feed contextual/pessoal dele. Read que a **Yala sinalizou diretamente** como resíduo vivo.

## READ-FIRST (feed.routes.ts inteiro + service)
- 3 rotas: `GET /feed/contextual` (`getContextualFeed(tenant, actionContext.actorId, limit)` — **A**, sem gate, e sem checar `actionContext`); `POST /feed/action` (**write**, fora de escopo); `GET /feed/unread-counts` (contagens de conteúdo **`visibility='PUBLIC'`** — **B público**, fora de escopo).
- `getContextualFeed` é **100% personalizado**: `profileInferenceService.getInferences(tenant, actorId)` → `userState`/`insights`/`suggestions` → seções geradas (`generatePleasureContent`/`generateLearningContent`/…). _(Nota: o param do service chama-se `userId` mas recebe `actorId` — mismatch da família SOCIAL-2 do `Cleiton.md`; não afeta o gate, cujo sujeito é o `actionContext.actorId`.)_
- DEV: `posts=0` — **mas o feed vem do estado inferido do actor, não de posts** → `getContextualFeed(devActor)` retorna estrutura mesmo assim → **behavioral real é possível**.

## Implementação (backend; 1 arquivo; sem Bank/migration/frontend)
`GET /feed/contextual`: após `req.user`(401)/`req.tenant`(400), adicionado `if (!req.actionContext?.actorId) → 400` (faltava; a linha de leitura podia lançar) + gate fail-closed `canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId)` → 403 ANTES de `getContextualFeed`. **Não altera** ranking/algoritmo/semântica/filtros (a chamada a `getContextualFeed` permanece idêntica).

## Padrão de gate (classificação F6.5.0)
- feed contextual = **CRA** (actor-keyed personalizado; representável passa, alheio → 403).

## Prova — BEHAVIORAL REAL (cobrança Clayton)
- **e2e novo** `validate-pipeline-e2e-feed-contextual-authorship-f6-5-4` **8/8**: **A** behavioral primitivo nega cross-user (decisão do gate); **B** **behavioral REAL — o e2e chama `feedService.getContextualFeed(TENANT, devActor, 20)` de verdade** e assere que retorna `FeedContextual` (`userState`+`sections[]`+`contextHeader`); logs `[semantic] FALLBACK_STATS`/`DECISION_STATS` provam execução. _(Distinção honesta vs F6.5.2/6.5.3: lá o substrato — `bank_accounts`/`contextual_threads` — estava **ausente** em DEV (N/A inevitável); aqui o substrato existe e a fonte do feed é o estado do actor, então behavioral roda apesar de `posts=0`.)_ **C** estrutural gate-antes-da-leitura + 401/400/403 fail-closed + `/unread-counts` público intocado.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**).
- **Núcleo 0113 + F6.5.1/2/3 intactos:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7 · contextual-thread-f6-5-3 8/8.

## O que NÃO foi tocado
ranking/algoritmo/filtros do feed · `/feed/action` (write) · `/feed/unread-counts` (público) · ledger · inbox · commitments · contextual-thread · events · service-order · dashboard/reports · R2 · Bank · migration · frontend.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` OPEN (F6.5.4 fechada; restam 6.5.5–6.5.9). DT-mãe OPEN.

## Próximo passo (espera go)
**F6.5.5 — company-members GETs** (`GET /:companyId/members[/:memberId]`; a fatia 2 gateou só os writes — reads ficaram nus; canManageCompany).
