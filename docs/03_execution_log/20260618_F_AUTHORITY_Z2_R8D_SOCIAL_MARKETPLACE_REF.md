# 2026-06-18 — R8D SOCIAL-MARKETPLACE-REF — SCHEMA-GHOST CONTAINMENT (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-18, sobre commit material `c334cabc`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (CLOSED_AS_CONTAINED,
> NÃO `CLOSED` simples — não remedia a feature `social_marketplace_refs` funcionalmente; apenas contém rotas
> mortas por schema-ghost; e **NÃO** fecha a DT-mãe 0113 nem o parent canal-1). Yala confirmou materialmente:
> HEAD c334cabc · branch rescue-structural · check:migrations 394/394 · diff de 9 arquivos; sem migration/schema;
> sem Bank/Core/ledger/splits/payout/recovery; sem RBAC/FASE 6; sem actor_delegations/R2; sem R7b/R8A/R8B/R8C/
> social-legacy/profile-c1/system-notifications; frontend intocado; sibling marketplace-refs (feature diferente)
> não alterado; service/repo/types ficaram como dead code residual; as 3 rotas permanecem registradas;
> `actionContext.actorId` era **só breadcrumb de auditoria** no source pré-diff (em `auditService.record` low
> severity/non-blocking try/catch; `createRef(tenantId, req.body)` nunca recebia o actor → não governava o sink);
> **`social_marketplace_refs` confirmado como SCHEMA-GHOST** (`SELECT to_regclass('public.social_marketplace_refs')
> = NULL`; sem CREATE TABLE canônico; só em `migrations_archive/0759`; INSERT/SELECT/DELETE dariam 42P01; bind não
> resolveria; migration fora de escopo, não criada → **CONTAIN correto**); as 3 rotas retornam **501
> `SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED`** ANTES de qualquer service/DB; sem `actionContext.actorId`/
> `auditService.record`/`createRef`/repository/write/read/delete/referência à tabela ghost no route file; o
> frontend ainda chama as 3 rotas, mas antes era 500/42P01 e agora **falha honestamente com 501**; guard material
> confirmado; **E2E DB-free 5/5 rodado pela Yala**; baseline reduzido honestamente (**flagged 15→14 · baseline
> 22→21 · new=0**); actor-authority-boundary OK · actor-writer-boundaries OK · bank-ledger-boundaries OK ·
> regression-guards OK · arch `--strict` critical_new=0 · tsc baseline 43; cartório correto; **DT-mãe 0113 e
> parent canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> source); validado estruturalmente pela Yala + executora declarou execução em **pwsh 7 e Windows PowerShell 5.1**.
> **W2** — working tree sujo fora do material (docs/memorias/untracked/artefatos) → não é HOLD_WORKTREE_DIRTY.
>
> **Residual/follow-up registrado (NÃO executar agora):** se a feature `social_marketplace_refs` for revivida —
> materializar substrato canônico; decidir modelo de autoria/ownership (possivelmente post-owner); decidir se o
> DDL arquivado em `migrations_archive/0759` vira migration viva; criar binding canônico com `canRepresentActor`;
> remover/reabilitar service/repo/types dead code; criar E2E cross-actor + guard + negative-proof; fazer Yala
> reseal. Seal = docs-only; HEAD material permanece `c334cabc`. _(Detalhe IMPLEMENTED abaixo.)_

Auditoria da superfície `social-marketplace-ref` (DECISION-0113 / DECISION-0131 §B7 / Z2), classificada no R8 como
"contenção simples possível: write existe, actor aparentemente é breadcrumb, não toca Bank". O READ-FIRST/PROVA
confirmou **duas** coisas: (1) o `actionContext.actorId` é apenas **breadcrumb de auditoria** (o write nunca
recebia o actor); (2) a tabela `social_marketplace_refs` é **SCHEMA-GHOST** → decisão **Caso C (CONTER)**.

## Anchor / Pré-flight

HEAD inicial `1bcfbe18` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8A CLOSED_AS_CONTAINED · R8B CLOSED · R8C CLOSED_AS_CONTAINED;
parent canal-1 OPEN (baseline 22); DT-mãe 0113 OPEN.

## READ-FIRST — prova material

**Rotas (3, registradas via `socialModule`→`socialMarketplaceRefRoutes`, prefixo `/social`):** POST
`/social/marketplace-ref` (createRef) · GET `/social/marketplace-ref/:postId` · GET
`/social/marketplace-ref/details/:refId`. **Callers vivos:** frontend `api/social.ts` chama as 3.

**Actor é breadcrumb (não autoridade):** no handler POST, `actionContext.actorId` é lido APENAS para o registro
de auditoria (`auditService.record`, severity low, em try/catch non-blocking). O write `createRef(tenantId,
req.body)` **NÃO recebe o actor** — usa só postId/refType/refId/metadata. O actor client-declared não governa o
sink (breadcrumb puro).

**ACHADO DECISIVO — SCHEMA-GHOST (dead-at-db):** a tabela `social_marketplace_refs` **não existe**:
- `to_regclass('public.social_marketplace_refs') = null` em **unificard_dev** (verificado read-only; row_count=null).
- O `CREATE TABLE` vive SÓ em `migrations_archive/0759_social_marketplace_refs.sql` (arquivo, fora do set canônico
  de 394).
→ o repository faz INSERT(UPSERT)/SELECT/DELETE numa tabela inexistente: **toda rota é dead-at-db (500 hoje)**.

## Decisão aplicada: CONTAIN (Caso C — schema ghost)

Embora o actor seja breadcrumb (Caso B), a realidade material mais profunda é o módulo inteiro dead-at-db. A
correção honesta — e idêntica ao precedente R8C — é **CONTER** (501 nomeado) ANTES de qualquer service/DB; NÃO
religar, NÃO criar migration, NÃO redesenhar marketplace (o prompt instrui: schema ghost → conter, sem migration).

**Fix cirúrgico (route-only):** as 3 rotas passam a retornar **501 `SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED`**
(msg "Social marketplace references are temporarily unavailable (schema not materialized."). Removidos do route
file: imports `socialMarketplaceRefService`/types, a chamada `createRef`, o bloco de auditoria e o
`actionContext.actorId`. Rotas **permanecem registradas**. Service/repository/types **intocados** (agora dead code
sem caller — `rg` confirma zero caller externo de `socialMarketplaceRefService.`/`socialMarketplaceRefRepository.`;
residual de limpeza futura). **Sem migration, sem redesenho.**

## Baseline canal-1 — removido honestamente

`social-marketplace-ref.routes.ts` **REMOVIDO do BASELINE** (`audit-actor-authority-boundary.mjs`): após a
contenção o arquivo não lê mais `actionContext.actorId` → não casa `CLIENT_ACTOR_CHANNELS` → não é flagged e não
precisa de baseline (mesmo padrão R8C/settlement/unifycard). Antes/depois: **flagged 15→14 · baseline 22→21 ·
new=0** · stale/recognized inalterados. GATE OK. (Não-mascaramento: o canal foi eliminado do código.)

## Prova material — E2E (sem DB) + guard + negative-proof

- E2E `validate-pipeline-e2e-social-marketplace-ref-schema-ghost-containment.ts` → **5/5** (a rota contida NÃO
  importa pool/service → `fastify.inject` não conecta a banco): A POST→501 · B GET :postId→501 · C GET
  details/:refId→501 · D guard verde · E baseline verde. Todos com code `SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED`.
- Guard `audit-social-marketplace-ref-schema-ghost-containment.mjs` em `validate:regression-guards`: exige code
  nomeado, ≥3 rotas registradas, ≥3 retornos 501 contidos; **proíbe** qualquer
  `socialMarketplaceRefService.`/`socialMarketplaceRefRepository.`/`createRef`/`getRefsByPost`/`getRefById`/
  `getRefWithDetails`/`removeRef`, a tabela `social_marketplace_refs` e `actionContext.actorId`.
- Negative-proof versionado `negative-proof-social-marketplace-ref-schema-ghost-containment.ps1` (ASCII/sem-BOM,
  pwsh 7 + WPS 5.1): reintroduz `socialMarketplaceRefService.createRef` no POST → **GATE FAIL exit 1** → restaura
  byte-idêntico → git status inalterado → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0** (baseline 22→21; social-marketplace-ref removido) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**
(baseline; 0 erro novo) · negative-proof bites em pwsh 7 + WPS 5.1.

## Escopo negativo

NÃO tocou R7b/R8A/R8B/R8C/social.routes-legacy/profile-c1/system-notifications · Bank/Core/ledger/splits/payout/
recovery · RBAC/FASE 6 · actor_delegations/R2 · **sem migration** (schema-ghost provado → não criar, por
instrução) · sem schema · NÃO redesenhou marketplace · NÃO criou rota nova · NÃO removeu rotas (contidas,
registradas) · NÃO fecha DT-mãe 0113 nem parent canal-1.

## Estado

**✅ CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-18 sobre commit material
`c334cabc`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2 + residual registrados como
follow-up não-bloqueante — ver bloco SEAL no topo). `R8D social-marketplace-ref schema-ghost` →
**CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. `DT-AUTHORITY-Z2-SOCIAL-MARKETPLACE-REF` →
**CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**. **CLOSED_AS_CONTAINED ≠ remediação funcional:** não
materializa/redesenha a feature — apenas contém rotas mortas por schema-ghost; a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e o parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN** (parent encolheu 22→21). **Residual (follow-up, fora do escopo):** materializar o substrato
`social_marketplace_refs` (DDL em migrations_archive/0759) + decidir o modelo de autoria/ownership (post-owner?) +
binding canônico (canRepresentActor) + remoção/reabilitação do service/repo/types dead-code + E2E cross-actor/
guard/negative-proof, se a feature for revivida — frente própria. _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do
reseal.)_
