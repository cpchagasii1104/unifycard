# 2026-06-16 — F-CONTEXTUAL-THREAD-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT

Contenção fail-closed do módulo `contextual-messaging`, montado mas dependente de tabelas inexistentes
(schema ghost). Não-financeiro, escopo local, zero migration/schema/religação. Mesmo padrão de
`F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT`.

## Anchor / Pré-flight

HEAD inicial `f9604558` · branch `rescue-structural` · superfícies materiais LIMPAS · dev/migration **390**.
STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: STATUS · DT_LOG · execution log de votes containment (precedente) · `contextual-thread.routes.ts`
· `contextual-thread.service.ts` · `contextual-thread.repository.ts` · `contextual-messaging.module.ts` ·
`app.builder.ts` (montagem) · migrations (schema).

## Prova do schema ghost

- `grep` em `backend/migrations`: **zero** `CREATE TABLE ... contextual_threads`/`contextual_messages` (nem
  menção). As tabelas **não existem** no schema canônico.
- DB efêmera FULL: `to_regclass('public.contextual_threads')=NULL` e `to_regclass('public.contextual_messages')=NULL`
  (e2e S0/S1).
- O repository (`contextual-thread.repository.ts`) faz INSERT/SELECT/UPDATE em ambas → qualquer rota emitiria
  `42P01 relation does not exist`.
- Módulo **MONTADO** (`app.builder.ts:558`, atrás de `isMessagingEnabled()`).

## Rotas auditadas (7 = 3 writes + 4 reads, TODAS tocam o schema ghost)

| Rota | Tipo | Service/tabela | Risco latente |
| --- | --- | --- | --- |
| POST /contextual-threads | write | createThread → contextual_threads | body cru |
| POST /:threadId/participants | write | addParticipant → contextual_threads | **body.actorId cru** |
| POST /:threadId/messages | write | sendMessage → contextual_messages | **actionContext.actorId cru** (autoria) |
| GET /contextual-threads | read | listThreads → contextual_threads | — |
| GET /:threadId | read | getThreadById → contextual_threads | — |
| GET /context/:t/:id | read | getThreadByContext → contextual_threads | — |
| GET /:threadId/messages | read | getMessages → contextual_messages | — |

## Reads incluídos? SIM — decisão IA Diretora

Os reads batem nas MESMAS tabelas ghost → emitiriam 500 cru. Conter só os writes deixaria GET vazando 500 por
`relation missing`. Decisão IA Diretora: conter reads na mesma frente. (O read-gate prévio `assertThreadParticipant`
/F6.5.3 foi removido junto — superfície morta; reaproveitar na religação, ver DT latente.)

## Patch (contenção fail-closed)

`contextual-thread.routes.ts` — handler único `contained` retorna **`501` `CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED`**
como 1ª instrução; as 7 rotas o usam. ZERO chamada ao service/repository, ZERO DB, ZERO write, ZERO autoria.
`assertThreadParticipant`/`canRepresentActor`/`actionContext.actorId`/`req.body`/imports do service + types REMOVIDOS.
`contextual-thread.service.ts`/`.repository.ts` **NÃO tocados** (religação = frente própria).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline; arquivos contextual limpos) |
| guard `audit-contextual-thread-schema-ghost-containment.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-...ps1` | **5 mordidas** (drop-contain-code · reexpose-service · reintroduce-actionctx · reintroduce-bodyactor · reanimate-binding) + restauração byte-idêntica SHA256 |
| e2e efêmero `contextual-thread-schema-ghost-containment` | **13/13** |
| GATE actor-writer / bank-ledger | OK / OK |
| GATE regression-guards | rc=0 (inclui novo guard) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

**e2e:** S0/S1 schema-ghost confirmado (`to_regclass=NULL` p/ threads e messages); T1-T7 as 7 rotas → 501 nomeado
e **NÃO** 500 (prova do curto-circuito pré-DB; uma rota não-contida emitiria 42P01); T-bank Bank intocado; C1-C3
estruturais (contenção presente, 7 rotas contidas, zero service/actionContext.actorId/req.body/canRepresentActor).

## DTs registradas

- **DT-CONTEXTUAL-THREAD-SCHEMA-GHOST** — OPEN (raiz) / contenção IMPLEMENTED.
- **DT-CONTEXTUAL-THREAD-WRITE-AUTHORSHIP-BINDING-LATENT** — OPEN / futuro (binding na religação).
- **DT-ORGANIZERS-BUILT-BUT-UNMOUNTED** — OPEN / decisão Clayton (achado adjacente READ-ONLY: organizers tem
  módulo/rotas/service/schemas/billing/stripe + migrations, mas não está montado; reviver = decisão de produto
  com billing/Stripe; NÃO tocado).

## Escopo negativo (verificado)

ZERO migration/schema/tabelas contextual · ZERO religação/ativação · ZERO `contextual-thread.service`/`.repository`
· ZERO binding/canRepresentActor sobre rota morta · ZERO organizers (só leitura p/ DT) · ZERO organizer
billing/plans/stripe · ZERO votes/service-order/service-bundle · ZERO Bank/Core/`bank_ledger`/payout/split/recovery/
payment/invoice · ZERO RLS/RBAC/FASE 6 · ZERO contacts/suppliers/agenda.

## Estado

**IMPLEMENTED / HOLD RESEAL.** Fecha SÓ como **F-CONTEXTUAL-THREAD-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT**: as 7
rotas de `contextual-thread` ficam contidas fail-closed (501 nomeado, zero DB, curto-circuito pré-DB, sem 42P01); a
raiz (schema ghost) permanece OPEN; feature NÃO ativada. dev 390. **Aguarda reseal Yala.**
