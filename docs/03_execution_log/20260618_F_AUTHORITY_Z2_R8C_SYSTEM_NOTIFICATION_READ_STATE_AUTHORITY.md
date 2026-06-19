# 2026-06-18 — R8C SYSTEM-NOTIFICATION READ-STATE AUTHORITY — SCHEMA-GHOST CONTAINMENT (cirúrgico)

Frente de autoridade sobre os writers de read-state de notificações (DECISION-0113 / DECISION-0131 §B7 / Z2). A
hipótese de entrada era "writer vivo perigoso" com recipient client-declared. O **READ-FIRST/PROVA reverteu a
hipótese**: a tabela `system_notifications` é **SCHEMA-GHOST** → decisão **Caso B (CONTER)**, não BIND.

## Anchor / Pré-flight

HEAD inicial `fa67724b` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8A CLOSED_AS_CONTAINED; R8B CLOSED; DT-mãe 0113 + parent
canal-1 OPEN.

## READ-FIRST — prova material (hipótese revertida)

**Rotas (5, registradas sob `protectedScope` via `systemNotificationsModule`):** GET `/system-notifications`
(list) · GET `/system-notifications/unread-count` · GET `/system-notifications/:notificationId` · **W1** POST
`/system-notifications/:notificationId/read` (markAsRead) · **W2** POST `/system-notifications/mark-all-read`
(markAllAsRead). **Callers vivos:** frontend `api/system-notifications.ts` chama as 5 (NotificationBell/List).

**Violação de autoridade (canal-1/0113):** W1 `markAsRead(tenantId, notificationId)` — `UPDATE ... WHERE
notification_id` SEM dono (qualquer notificação do tenant por ID); W2 `markAllAsRead(tenantId, recipientActorId)`
com `recipientActorId = body || actionContext.actorId` (client-declared) — bulk UPDATE spoofável. Reads idem
(recipientActorId client-declared).

**ACHADO DECISIVO — SCHEMA-GHOST (dead-at-db):** a tabela `system_notifications` **NÃO existe**:
- `to_regclass('public.system_notifications') = null` em **unificard_dev** (verificado read-only; row_count=null).
- O `CREATE TABLE` vive SÓ em `migrations_archive/0921_system_notifications.sql` (cabeçalho:
  `migrations/257_create_system_notifications.sql` — migration **arquivada**, fora do set canônico de 394).
- E2E em DB efêmera (FULL) falhou com **42P01 (relation does not exist)** ao tentar semear.
→ o repository faz INSERT/UPDATE/SELECT numa tabela inexistente: **toda rota é dead-at-db (500 hoje)**.

## Decisão aplicada: CONTAIN (Caso B — schema ghost)

O prompt antecipa o caso ("schema ghost prova que a rota deve ser contida — nesse caso NÃO criar migration").
Como o substrato não existe, BIND não resolveria (o write continuaria 500). Contenção honesta = **501 nomeado**
ANTES de qualquer service/DB, igual aos precedentes schema-ghost (organization/contextual-thread/contacts).

**Fix cirúrgico (route-only):** as 5 rotas passam a retornar **501 `SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED`**
(msg "System notifications are temporarily unavailable (schema not materialized."). Removidos do route file: os
imports `systemNotificationService`/`SystemNotificationFilters`, toda chamada service/repository, e os canais
client-declared (`actionContext.actorId`/`recipientActorId`). Rotas **permanecem registradas** (não removidas).
Service/repository **intocados** (agora dead code sem caller — residual de limpeza futura; `rg` confirma zero
caller externo de `systemNotificationService.`/`systemNotificationRepository.`). **Sem migration, sem redesenho.**

## Baseline canal-1 — removido honestamente

`system-notification.routes.ts` **REMOVIDO do BASELINE** (`audit-actor-authority-boundary.mjs`): após a contenção
o arquivo NÃO lê mais nenhum canal client-declared (actionContext.actorId/recipientActorId desapareceram) → não
casa `CLIENT_ACTOR_CHANNELS` → não é flagged e não precisa de baseline (mesmo padrão de settlement/unifycard/
dispute pós-contenção). Antes/depois: **flagged 16→15 · baseline 23→22 · new=0** · stale_baseline 7 · recognized
inalterados. GATE OK. (Não é mascaramento: o canal foi eliminado do código, não escondido.)

## Prova material — E2E (sem DB) + guard + negative-proof

- E2E `validate-pipeline-e2e-system-notification-schema-ghost-containment.ts` → **7/7** (a rota contida NÃO
  importa pool/service → `fastify.inject` não conecta a banco): A list→501 · B unread-count→501 · C :id→501 ·
  D :id/read (W1)→501 · E mark-all-read (W2, recipient client-declared IGNORADO)→501 · F guard verde · G baseline
  verde. Todos com code `SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED`.
- Guard `audit-system-notification-schema-ghost-containment.mjs` em `validate:regression-guards`: exige code
  nomeado, ≥5 rotas registradas, ≥5 retornos 501 contidos; **proíbe** qualquer
  `systemNotificationService.`/`systemNotificationRepository.`/`markAsRead`/`markAllAsRead`/`createNotification`/…,
  a tabela `system_notifications` e os canais `actionContext.actorId`/`recipientActorId`.
- Negative-proof versionado `negative-proof-system-notification-schema-ghost-containment.ps1` (ASCII/sem-BOM,
  pwsh 7 + WPS 5.1): reintroduz `systemNotificationService.markAllAsRead` em W2 → **GATE FAIL exit 1** → restaura
  byte-idêntico → git status inalterado → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0** (baseline 23→22; system-notification removido) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**
(baseline; 0 erro novo) · negative-proof bites em pwsh 7 + WPS 5.1.

## Escopo negativo

NÃO tocou R7b/R8A/R8B/social/profile-c1 · Bank/Core/ledger/splits/payout/recovery · RBAC/FASE 6 ·
actor_delegations/R2 · **sem migration** (schema-ghost provado → não criar, por instrução) · sem schema ·
NÃO redesenhou notificações · NÃO criou rota nova · NÃO removeu rotas (contidas, registradas) · NÃO fecha DT-mãe
0113 nem parent canal-1.

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. `system-notification read-state` → **CONTAINED (schema-ghost) / HOLD YALA**.
`DT-AUTHORITY-Z2-SYSTEM-NOTIFICATION-READ-STATE` → **IMPLEMENTED_AS_CONTAINED / HOLD YALA**. DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN**. **Residual (follow-up, fora do escopo):** materializar o substrato `system_notifications`
(DDL em migrations_archive/0921) + binding canônico (canRepresentActor) + remoção do service/repo dead-code, se a
feature de notificações for revivida — frente própria. Próximo passo: **Yala reseal**.
