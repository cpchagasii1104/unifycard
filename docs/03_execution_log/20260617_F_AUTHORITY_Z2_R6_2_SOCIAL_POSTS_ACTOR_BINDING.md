# 2026-06-17 — F-AUTHORITY-Z2-R6.2-SOCIAL-POSTS-ACTOR-BINDING (material, cirúrgico)

Contenção **localizada** de `POST /social/posts` (DECISION-0113 / DECISION-0131 §B7 / Z2): criar post "como"
um actor declarado provava só existência, sem representação server-side. `actorId` declarado é HINT, nunca
autoridade. Non-money; sem migration/schema; feed/comments/likes/media/KYB/ranking/timeline e R1-R6.1
intocados.

## Anchor / Pré-flight

HEAD inicial `556940bc` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`…`556940bc`
(15) presentes. Sem sujeira material em social/posts/authority/action-context/bank/ledger/migrations/
R1-R5/R6.1/referral.

## Causa-raiz (READ-FIRST)

- **Autor do post = `posts.actor_id` = `actor.actor_id`**, resolvido em `createPost`: se `validated.actor_id`
  (body) presente → `actorRepository.findById(actor_id)` (só existência); senão → `ensureUserActor(userId)`
  (actor próprio). O body `actor_id` (quando presente) vira o autor **sem** representação.
- `createdAsActorId = req.actionContext.actorId` (canal-1) vai **só** para `metadata.created_as_actor_id`
  (auditoria), nunca para a coluna autor.
- Único gate prévio: `requirePermission('publish_feed')` (rota, só quando `validated.actor_id` presente) —
  permissão de **MÓDULO/capability** com subject de `actionContext.actorId`, **não** representação.
- Recon (workflow READ-ONLY, 5 leitores): `authorityService.canPerformAction`→`canActAs` (no service) **já**
  exige representação + capability e é fail-closed para capability-sem-representação — então **adicionar
  `canRepresentActor` é puro TIGHTENING fail-closed, sem conflito** (STOP §8 descartado). Page-owner passa
  via `canManageCompany` (`can_manage_company OR role='owner'`). `req.user.userId` disponível no
  protectedScope. Route catch converte throws do service em **500** → exige gate na rota p/ 403 limpo.

## Correção (cirúrgica — só `social-2.0.routes.ts`)

No handler `POST /posts`, após `const createdAsActorId = req.actionContext.actorId` e antes do
`requirePermission('publish_feed')`/`createPost`:
```
if (validated.actor_id) {
  let canRepresentAuthor = false;
  try {
    const { authorizationService } = await import('@core/authorization/authorization.service');
    canRepresentAuthor = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id);
  } catch { canRepresentAuthor = false; }
  if (!canRepresentAuthor) return reply.status(403).send({ ok:false, code:'SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', error:'...' });
}
```
- **Subject** = `req.user.userId` (server-side). **Target** = `validated.actor_id` (o autor declarado).
- Mirror do idioma DECISION-0113 já vivo no arquivo (leitura de ledger, linhas ~664-668).
- `requirePermission('publish_feed')` **preservado** (gate adicional, nunca substituto); KYB/canActAs no
  service preservados.
- Sem `actor_id` → autoria do próprio actor do usuário (`ensureUserActor`) → representável por construção,
  sem gate necessário.

**Defesa em profundidade NÃO adicionada no service** `createPost`: ele tem **callers internos confiáveis**
(`votes.service`/`groups.service`/`events.service`/`seed-dev-groups`) que postam como actors de grupo/evento;
um gate incondicional no service quebraria esses fluxos (fora do escopo R6.2 e proibidos de tocar). O gate
vive na **única superfície client-declared**: a rota HTTP. Decisão registrada (STOP-discipline).

**Sem alteração no baseline canal-1** de `audit-actor-authority-boundary.mjs`: `social-2.0.routes.ts` já era
binding-exempt (contém `canRepresentActor` em outras rotas) e **nunca foi uma chave do BASELINE** — ao
contrário de settlement/unifycard (R4), intent-execute (R5), services.routes (R6.1).

## E2E

`run-social-posts-actor-binding-ephemeral.ps1` → **14/14 verdes** (DB efêmera dedicada; nunca unificard_dev):
- **A (estrutural):** A1 gate `canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id)` · A2
  403 `SOCIAL_POST_ACTOR_NOT_REPRESENTABLE` · A3 gate **antes** de `social2Service.createPost`.
- **B (primitivo):** B1 `canRepresentActor(A.userId, pageA)=true` (owner via `canManageCompany`) · B2
  `(B.userId, pageA)=false`. Page seedada via companies + company_users(`can_manage_company=true`,
  `member_status='active'`) + actors(`page`, company_id).
- **C (HTTP real via `fastify.inject`):** C1 spoof (B publica como page de A) → **403** · C2 zero linha nova
  em `posts(pageA)` · C3 legítimo (A publica como page de A) **passa do gate** (falha adiante por
  KYB/publish_feed, nunca 403-repr).
- **D (não-regressão):** D1 R6.1 services · D2 R5 intent-execute · D3 R1 groups · D4 R3 reports · D5 R4
  marketplace. **E1** bank_ledger/bank_transactions/bank_splits intocados.

## Guard + Negative-proof

Novo `scripts/audit-social-posts-actor-binding.mjs` em `validate:regression-guards`: exige
`canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id)` antes de `social2Service.createPost`,
403 `SOCIAL_POST_ACTOR_NOT_REPRESENTABLE`; proíbe `validated.actor_id`/`req.actionContext` como subject;
exige R6.1 services sem regressão. (Não exige gate no service — decisão registrada: callers internos.)
**Negative-proof versionado** `scripts/negative-proof-social-posts-actor-binding.ps1` (ASCII puro, sem BOM,
pwsh 7 **e** Windows PowerShell 5.1): spoof do subject → **GATE FAIL (exit 1)** → restaura byte-idêntico →
**git status inalterado** → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente, nenhum nas minhas alterações) ·
check:migrations OK (**sem migration**) · tsc baseline **43** — **0 erro novo na frente**.

## Escopo negativo

Sem migration/schema; service `createPost` **não gateado** (callers internos preservados); baseline canal-1
**não alterado**; Bank/ledger/splits, R1/R2/R3/R4/R5/R6.1, referral, event-rfq/feed-action/venue/
system-notifications/store-onboarding/business-permissions/unifycard **intocados**; feed/comments/likes/
media/KYB/visibility/ranking/timeline não tocados.

## Caller analysis (Yala — reseal material READ-ONLY)

`social2Service.createPost` callers: `POST /social/posts` = **EXTERNAL_ROUTE_GATED**; events/groups/votes/
event-feed = **INTERNAL_SYSTEM_SAFE**; seed/test = **SEED_TEST_ONLY**; **zero EXTERNAL_ROUTE_UNGATED**. Confirma
a decisão de gatear a rota (única superfície client-declared) e NÃO o service (callers internos confiáveis).

## Proof-hygiene pós-reseal (sem novo commit; HEAD permaneceu `c41476f7`) — W1/W2 follow-up

Reseal Yala material READ-ONLY = **PASS_WITH_WARNINGS** (E2E 14/14, gates, guard, leitura adversarial dos
callers). Warnings registrados como **follow-up não-bloqueante**, não como bloqueio do fechamento:

- **W1 — rota legada `/social/posts/create`:** externa e sem representation gate, **mas dead-at-db** no schema
  canônico — usa service legado/`social.repository`, **não** `social2Service.createPost`, **não cria post
  hoje**. Registrado como follow-up recomendado / DT futura de contenção da rota legada. **Não implementar
  neste commit; não bloqueia o fechamento da R6.2.**
- **W2 — negative-proof não reexecutado pela Yala:** o script muta fonte temporariamente, incompatível com o
  mandato READ-ONLY. **Não bloqueia:** a executora já o executou em **pwsh 7 e Windows PowerShell 5.1** (base
  passa → spoof do subject faz o guard FALHAR exit 1 → restauração byte-idêntica → git status inalterado), e a
  Yala validou guard + E2E 14/14 + a propriedade material. Procedural, não material.

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-17 sobre commit material `c41476f7`; reseal Yala
material READ-ONLY = PASS_WITH_WARNINGS; warnings W1/W2 registrados como follow-up não-bloqueante). dev 394.
`DT-AUTHORITY-Z2-SOCIAL-POSTS-ACTOR-BINDING-UNBOUND` → **CLOSED / YALA PASS MATERIAL**. **Esta frente fechou
somente a contenção localizada de social-posts actor binding. Não fecha Z2 inteiro, Z1, Z3, authority global
nem a DT-mãe 0113** — o parent canal-1 `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` e a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` permanecem **OPEN**. R1/R2/R3/R4/R5/R6.1 **não reabertos**;
feed/comments/likes/media/KYB/ranking/timeline e Bank/ledger/splits **não regrediram**. Nenhum código material
alterado no seal. **Continuidade (NÃO executar agora):** F-REFERRAL-REGISTER-ACTOR-CODE-GATE (próxima
recomendada) · R6.3 feed-action · R7 event-rfq money-adjacent · venue/system-notifications schema-ghost ·
business-permissions/check (decisão Clayton) · guard cross-module Z2.
