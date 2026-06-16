# 2026-06-16 — F-ORGANIZATION-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT

Contenção fail-closed (blanket) do módulo `organization`, montado mas dependente de tabelas inexistentes
(schema ghost; `organization_members` é tombstone). Não-financeiro, escopo local, zero migration/schema/
religação. Mesmo padrão de votes/contextual-thread.

## Anchor / Pré-flight

HEAD inicial `5183e0ae` · branch `rescue-structural` · superfícies materiais LIMPAS · dev/migration **390**.
STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: STATUS · DT_LOG · execution logs de containment (votes, contextual-thread) ·
`organization.routes.ts` · services/repositories de organization · `app.builder.ts` (montagem) ·
migrations (schema) · docs do tombstone (`DECISION_0131_AUTHORITY_GRAMMAR.md`, `WAVE1_BATCH1`, `MINHA_MEMORIA_DOCUMENTOS`).

## Prova do schema ghost + tombstone

- `grep` em `backend/migrations`: **zero** `CREATE TABLE ... organization_invites/members/units/roles`.
- DB efêmera FULL: `to_regclass=NULL` p/ as 4 tabelas (e2e S×4).
- services/repositories operam nessas tabelas → toda rota emitiria `42P01 relation does not exist`.
- **`organization_members` é TOMBSTONE conhecido** — `DECISION_0131_AUTHORITY_GRAMMAR.md:137` (tombstone guards),
  `20260614_WAVE1_..._BATCH1.md:28` ("tombstones não ressuscitam... AUSENTES no schema vivo"),
  `MINHA_MEMORIA_DOCUMENTOS.md:773` ("organization_members é tombstone por tabela ausente").
- Módulo **MONTADO** (`app.builder.ts:688-689`, prefixo `/organization`).

## Rotas auditadas (13 = 5 writes + 8 reads, TODAS tocam o schema ghost)

Writes: `POST /invites` (inviteUser) · `POST /invites/:id/accept` (acceptInvite, **body.actorId**) ·
`POST /invites/:id/revoke` · `POST /members/:id/role` (changeRole) · `POST /members/:id/remove`.
Reads: `GET /invites` · `GET /members` · `GET /units` · `GET /units/tree` · `GET /units/:id` ·
`GET /units/:id/children` · `GET /units/:id/descendants` · `GET /units/actor/:actorId`.

**Rota com tabela viva?** Nenhuma — as 13 dependem das 4 tabelas ghost. **Binding pré-existente:** o módulo já
tinha DECISION-0113 (`requireRepresentable`/`canRepresentActor`) — correto, mas sobre superfície morta → removido
(registrado em DT-ORGANIZATION-AUTHORITY-BINDING-LATENT p/ reaplicar na religação).

## Patch (contenção fail-closed blanket)

`organization.routes.ts` — handler único `contained` retorna **`501` `ORGANIZATION_SCHEMA_GHOST_CONTAINED`**
como 1ª instrução; as 13 rotas o usam. ZERO chamada ao service/repository, ZERO DB, ZERO write, ZERO autoria.
`requireRepresentable`/`canRepresentActor`/`actionContext.actorId`/`req.body`/imports de service + types REMOVIDOS.
`organization_members` **NÃO ressuscitada**. Services/repositories **NÃO tocados** (religação = frente própria).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline; arquivos organization limpos) |
| guard `audit-organization-schema-ghost-containment.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-...ps1` | **5 mordidas** (drop-contain-code · reexpose-service · reintroduce-actionctx · reintroduce-bodyactor · reanimate-binding) + restauração byte-idêntica SHA256 |
| e2e efêmero `organization-schema-ghost-containment` | **22/22** |
| GATE actor-writer / bank-ledger | OK / OK |
| GATE regression-guards | rc=0 (inclui novo guard) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

**e2e:** S×4 schema-ghost confirmado (`to_regclass=NULL` p/ as 4 tabelas); T1-T13 as 13 rotas → 501 nomeado e
**NÃO** 500 (prova do curto-circuito pré-DB; uma rota não-contida emitiria 42P01); T-bank Bank intocado;
T-tombstone `organization_members` continua ausente; C1-C3 estruturais (contenção presente, 13 rotas contidas,
zero service/repository/actionContext.actorId/req.body/canRepresentActor).

## DTs registradas

- **DT-ORGANIZATION-SCHEMA-GHOST** — OPEN (raiz) / contenção IMPLEMENTED.
- **DT-ORGANIZATION-AUTHORITY-BINDING-LATENT** — OPEN / futuro (reaplicar o binding DECISION-0113 na religação).

## Escopo negativo (verificado)

ZERO migration/schema/tabelas organization · ZERO ressurreição de `organization_members` · ZERO religação/ativação
· ZERO services/repositories de organization · ZERO binding sobre rota morta · ZERO human-mvp · ZERO votes/
contextual-thread/organizers/service-order/service-bundle · ZERO Bank/Core/`bank_ledger`/payout/split/recovery/
payment/invoice · ZERO RLS/RBAC/FASE 6 · ZERO contacts/referral.

## Estado

**IMPLEMENTED / HOLD RESEAL.** Fecha SÓ como **F-ORGANIZATION-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT**: as 13 rotas
de `organization` ficam contidas fail-closed (501 nomeado, zero DB, curto-circuito pré-DB, sem 42P01); a raiz
(schema ghost) permanece OPEN; feature NÃO ativada; `organization_members` (tombstone) NÃO ressuscitada;
ZERO schema criado. dev 390. **Aguarda reseal Yala.**
