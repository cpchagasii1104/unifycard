# 2026-06-15 — ONDA DECISION-0131 · B3f (GET /groups/mine — GUARD-LOCK do comportamento auth-derived)

Pós-selo do arco PDV (commit `d58db1c5`). Direção IA Diretora: voltar à onda 0131 com batch de **baixo risco**.
B3f = `GET /groups/mine`. **ZERO runtime change** — só guard + neg-proof + wiring + cartório. Parent `d58db1c5` ·
branch `rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST (READ-ONLY) — a premissa mudou

O alvo do B3f **já estava corrigido e committado**:
- `groups.routes.ts:495` (`GET /mine`): `const userId = req.user?.userId` (JWT server-side) · 401 fail-closed
  `UNAUTHENTICATED` · read-only · chama `getUserGroups(tenantId, userId)`. NÃO confia em actorId/actionContext.
- `action-context.plugin.ts:28`: bypass EXATO `req.method === 'GET' && rawPath === '/groups/mine'`
  (DECISION-0113: actorId de cliente = hint, não autoridade). O bypass de `/social/actors/available` (endsWith) é outro.
- `groups.repository.ts:463` (`getUserGroups`): filtra `gm.user_id = $2`.
- **Commits:** `c00435da` (derive subject from authenticated user) + `7c76cfb5` (decouple from action context).
- e2e HTTP real existente (`validate-pipeline-e2e-groups-mine-auth-derived.ts`): isolação A/B + spoof ignorado +
  read-only + sem estado.

**Dois resíduos REAIS (não o /groups/mine):**
- **R1 — sem guard de regressão:** o comportamento certo estava DESTRAVADO (e2e não está no `validate:regression-guards`).
  Podia regredir em silêncio.
- **R2 — namespace divergente no irmão:** `GET /groups/invites/mine` (1381) e `POST /groups/:id/request` (1411) usam
  `req.user!.globalUserId || req.user!.id` — namespace DIFERENTE (`global_user_id`/`id` vs `user_id`). É o drift das 3
  identidades paralelas. Mexer = abrir arco de identidade (NÃO baixo risco).

**Decisão IA Diretora:** R1 agora (guard-lock, zero runtime). R2 = DT (não abrir arco de identidade; não sequestrar a onda).

## Patch (R1 — só guard, ZERO runtime)

- **`scripts/audit-groups-mine-auth-derived.mjs`** (novo, no `validate:regression-guards`): trava o handler
  (`req.user?.userId` · 401 `UNAUTHENTICATED` · read-only · sem `actionContext`/`actorId`/`ensureUserActor`/
  `getActiveActor`) + o bypass EXATO do plugin (não endsWith/includes) + o filtro `gm.user_id = $2` do repository.
- **`scripts/negative-proof-groups-mine-auth-derived.ps1`** (novo): 6 mordidas.
- **`package.json`:** guard encadeado ao fim de `validate:regression-guards`.
- **NÃO tocado:** nenhum `.ts` de runtime · `/groups/invites/mine` · `:id/request` · identidade/mapper/namespace.

## Provas

- **Guard** `audit-groups-mine-auth-derived.mjs`: GATE OK.
- **Negative-proof**: **6 mordidas** byte-idêntico — (a) sem `req.user?.userId` · (b) sem 401 · (c) write (INSERT no /mine)
  · (d) re-acopla `actionContext` · (e) bypass do plugin vira endsWith · (f) repo deixa de filtrar `gm.user_id=$2`.
- **e2e existente** (`validate-pipeline-e2e-groups-mine-auth-derived.ts`): já committado verde em `7c76cfb5`; o guard
  agora trava as MESMAS invariantes (B1–B10) de forma estrutural no chain. _(Sem runner efêmero próprio; não re-rodado
  contra `unificard_dev` — o comportamento já está committado-verde e agora estruturalmente travado.)_

| Prova | Resultado |
| --- | --- |
| audit-groups-mine-auth-derived guard | GATE OK |
| negative-proof | 6 mordidas; byte-idêntico |
| validate:regression-guards (chain) | rc=0 (+1 guard) |
| tsc | build **25** · strict **43** (INALTERADO — zero `.ts` tocado) |

## NÃO TOCADOS

Runtime (`.ts`) · `/groups/invites/mine` · `POST /:id/request` · identidade/mapper/namespace
(`global_user_id`/`user_id`/`actor_id`) · Bank/Core/PDV · migration/seed/RBAC. dev 385/385.

## RESÍDUOS

- **R2 = DT-GROUPS-INVITES-MINE-NAMESPACE-DIVERGENT** (OPEN): convergir o namespace dos irmãos só quando a frente de
  identidade/mapper for aberta — **requer READ-FIRST de identidade**, NÃO patch isolado.

## Estado

B3f **IMPLEMENTED / HOLD PARA RESEAL**. `GET /groups/mine` já estava correto (auth-derived, fail-closed, spoof-ignorado,
read-only); o B3f **TRAVOU** esse comportamento com guard estrutural no chain (zero runtime) e registrou o drift do irmão
como DT. dev 385; baseline 0113=0; identidade NÃO aberta.
