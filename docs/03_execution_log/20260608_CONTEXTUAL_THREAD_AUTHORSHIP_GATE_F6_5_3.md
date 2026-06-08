# Execução — F-CONTEXTUAL-THREAD-AUTHORSHIP-GATE-F6_5_3 (DECISION-0113 fatia 6.5.3) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `31d65a40`
**Decisor:** Clayton (GO F6.5.3; READ-FIRST + "URL não é autorização") · **Esteira:** eu (escritora); par verifica.

## Objetivo
Impedir leitura de mensagens privadas por `threadId`/`contextId` arbitrário. Regra: só participante real (ou quem o representa) lê.

## READ-FIRST (contextual-thread.routes.ts inteiro + modelo de participante)
- 4 GET (leitura): `GET /contextual-threads` (lista; `participantActorId` era filtro do **cliente**); `GET /:threadId` (`getThreadById` por URL — IDOR); `GET /context/:type/:id` (`getThreadByContext`); `GET /:threadId/messages` (`getMessages` — **conteúdo privado**).
- **Modelo de participante EXISTE:** `contextual_threads.participant_actor_ids[]` (coluna array). O service **já o usa no gate de ESCRITA** (`sendMessage`: `if (!thread.participantActorIds.includes(senderActorId)) throw 'Apenas participantes podem enviar'`). → não há STOP; espelho a verdade que a escrita já exige.
- `getThreadById` throw NotFound(404) em ausência; `getThreadByContext` retorna null.

## Implementação (backend; 1 arquivo; sem Bank/migration/frontend)
Helper `assertThreadParticipant(req, reply, tenantId, thread)`: `req.user.userId` ausente → 401; `actionContext.actorId` ausente → 400; `canRepresentActor(tenantId, userId, actorId)` false → 403; `actorId ∉ thread.participantActorIds` (ou thread null) → **403 não-leak**.
- `GET /:threadId`: `getThreadById` → `assertThreadParticipant`; **404→403** (não revela existência).
- `GET /context/:type/:id`: thread null **ou** não-participante → **403 uniforme**.
- `GET /:threadId/messages`: resolve a thread (`getThreadById`) → `assertThreadParticipant` **antes** de `getMessages`.
- `GET /contextual-threads` (lista): prova `canRepresentActor` e **força `participantActorId = actionContext.actorId`** (ignora o filtro do cliente) → só threads do caller.
- **Writes** (`createThread`/`addParticipant`/`sendMessage`) **intocados** (escopo leitura; `sendMessage` usa `actionContext.actorId` como autor = família do write-authorship, DT própria).

## Padrão de gate (classificação F6.5.0)
- threads/messages = **OWN-PARAMS por participante** (`canRepresentActor` + membership em `participant_actor_ids`).
- lista = escopo forçado ao actor do caller.

## Prova
- **e2e novo** `validate-pipeline-e2e-contextual-thread-authorship-f6-5-3` **8/8**: **A** behavioral primitivo nega cross-user; **B** behavioral-por-thread **N/A** (tabela `contextual_threads` **ausente em DEV** — módulo não provisionado; `42P01` capturado, reportado, **não fake-green**); **C** estrutural gate-antes-da-leitura nos 4 + lista escopada + não-leak 404→403 + writes intocados.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**).
- **Núcleo 0113 + F6.5.1/6.5.2 intactos:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7.

## O que NÃO foi tocado
Writes de mensagem/participante/thread · ledger · feed · events · service-order · R2 · Bank · migration · frontend.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` OPEN (F6.5.3 fechada; restam 6.5.4–6.5.9). DT-mãe OPEN.

## Próximo passo (espera go)
**F6.5.4 — feed/contextual** (`GET /feed/contextual` lê `actionContext.actorId`; CRA).
