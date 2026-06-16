# 2026-06-16 — F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT

Subfrente derivada do STOP de `F-WRITE-AUTHORSHIP-VOTES-MODULE-BINDING`: o READ-FIRST **contradisse a
premissa** (writes spoofáveis vivos). Decisão IA Diretora: **conter fail-closed, NÃO religar**. Não-financeiro,
escopo local, zero migration/schema.

## Pré-flight

HEAD `8c113dc3` · branch `rescue-structural` · superfícies materiais LIMPAS · dev/migration **390**. STOP não disparado.

## READ-FIRST — premissa contradita (Evidence Pack)

Lidos 1ª mão: STATUS · DT_LOG · `votes.routes.ts` · `votes.service.ts` · `votes.types.ts` · `votes.repository.ts`
· `votes.module.ts` · `app.builder.ts` (registro) · `permission-keys.ts` · precedentes service-order/service-bundle.

**Achado — módulo `votes` DUPLAMENTE MORTO:**
1. **`req.activeActor` nunca é populado.** Verificação exaustiva (`grep` em todo `backend/src`): o identificador
   `activeActor` é **lido apenas** por `votes.routes.ts`; **zero** atribuição/`decorateRequest`/getter/hook em
   qualquer lugar. O padrão canônico (crm/loyalty/my-orders) é **chamar** `resolveActiveActorFromRequest(...)` —
   os votes referenciam um campo fantasma. → os 4 writes caíam em **401 "Actor não encontrado" ENGANOSO**.
2. **Schema ghost.** As tabelas `votes`/`vote_options`/`vote_responses` **não são criadas por nenhuma migration
   canônica** (`to_regclass('public.votes')=NULL` provado em DB efêmera FULL; só existem `group_vote_*`). →
   qualquer acesso ao DB emitiria `relation "votes" não existe`.

Logo o write-authorship-spoof do GO **não era alcançável**. Bug REAL latente confirmado (para a religação futura):
`createVote`/`publishVote`/`closeVote` passavam `actionContext.actorId` como **userId E globalUserId** (conflação;
o `userId` alimenta `social2Service.createPost`), com autoria de `activeActor.actor_id` sem `canRepresentActor`.

## Decisão (STOP → consulta → escolha IA Diretora)

Parei antes de editar e consultei (premissa falsa + religar = mudança de produto). **Escolha: conter explícito + DT,
não religar.**

## Patch (contenção fail-closed)

`votes.routes.ts` — os **4 writes** (`POST /votes` · `/:id/publish` · `/:id/vote` · `/:id/close`) retornam
**`501` `VOTES_ACTIVE_ACTOR_WIRING_MISSING`** com mensagem honesta. ZERO chamada ao `votesService`, ZERO escrita,
curto-circuito **antes** do DB. `actionContext.actorId` + schemas/imports de escrita órfãos REMOVIDOS. **Reads
intocados** (`GET /votes`, `/:id`, `/:id/audit`) — fora do escopo; seguem quebrados pelo schema ghost (pré-existente).
**`votes.service.ts` NÃO tocado** (a conflação vivia no call-site da rota, agora removido; religação = frente própria).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline; zero novo; arquivos votes limpos) |
| guard `audit-votes-writes-containment.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-votes-writes-containment.ps1` | **3 mordidas** (drop-contain-code · reexpose-write · reintroduce-actionctx) + restauração byte-idêntica SHA256 |
| e2e efêmero `votes-writes-containment` | **11/11** |
| GATE actor-writer-boundaries / bank-ledger-boundaries | OK / OK |
| GATE regression-guards | rc=0 (inclui novo guard) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

**e2e:** S0 schema-ghost confirmado (`to_regclass=NULL`); T1-T4 os 4 writes → 501 nomeado; T5 contenção **NÃO** emite
500 "relation does not exist" (prova do curto-circuito pré-DB); T-bank Bank intocado; C1-C4 estruturais (contenção
presente, zero write service call, zero `actionContext.actorId`, reads não alterados).

## DTs registradas

- **DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING** — OPEN (raiz) / contenção IMPLEMENTADA.
- **DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT** — OPEN / futuro (binding a aplicar na religação).
- **DT-VOTES-FINE-GRAINED-ELIGIBILITY-POLICY** — OPEN / decisão Clayton.

## Escopo negativo (verificado)

ZERO religação · ZERO `resolveActiveActorFromRequest` · ZERO ativação de votação · ZERO migration/schema · ZERO
`votes.service` · ZERO reads alterados · ZERO groups-votes/organizers/social-votes · ZERO Bank/Core/`bank_ledger`/
payout/split/recovery/payment/invoice · ZERO RBAC/RLS/FASE 6 · ZERO contacts/suppliers/agenda.

## Estado

**CLOSED / YALA PASS (contenção).** Fecha SÓ como **F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT**: os 4 writes de
`votes` ficam contidos fail-closed (501 nomeado, zero escrita, curto-circuito pré-DB); a conflação foi removida do
call-site; reads e service intocados. Religação + elegibilidade fina = frentes próprias (3 DTs OPEN). dev 390.

## YALA RESEAL — PASS (2026-06-16, READ-ONLY)

- **Veredito:** **PASS** (reseal READ-ONLY). Commit material `3404c565` · branch `rescue-structural` · dev 390.
- **Confirmado:** premissa do GO contradita (módulo duplamente morto: `req.activeActor` fantasma + schema ghost);
  os 4 writes (`POST /votes` · `/:id/publish` · `/:id/vote` · `/:id/close`) → **501 `VOTES_ACTIVE_ACTOR_WIRING_MISSING`**;
  ZERO chamada ao `votesService`; ZERO acesso ao DB; **NÃO** emite 500 "relation does not exist" (curto-circuito
  pré-DB provado no e2e T5); `actionContext.actorId` removido do arquivo; e2e **11/11**; guard **GATE OK**;
  neg-proof **3 mordidas** + SHA256 byte-idêntico; **4 gates verdes**; **Bank/Core/ledger intocados**.
- **A CONTENÇÃO está CLOSED; a RAIZ permanece OPEN:** votes **não** foi religado/ativado; tabelas **não** criadas;
  `activeActor` **não** resolvido; elegibilidade fina **não** decidida. Religação = frentes próprias com decisão Clayton.
- **DTs de raiz seguem OPEN:** DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING (raiz) · DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT ·
  DT-VOTES-FINE-GRAINED-ELIGIBILITY-POLICY.
- **Reads de votes:** seguem FORA do escopo (quebrados pelo schema ghost, pré-existente) — frente própria se desejado.
- **Selo:** commit docs-only `docs: seal votes write containment after yala pass`. Estado final: **CLOSED / YALA PASS** (contenção).
