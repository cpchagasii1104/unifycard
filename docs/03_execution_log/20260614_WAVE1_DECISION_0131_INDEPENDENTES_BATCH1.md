# 2026-06-14 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 1 (B4f + F1 + F2)

Pós-PASS Yala de DECISION-0131 (commit `b6f08e91`). Primeira onda de frentes INDEPENDENTES do plano definitivo,
executada em **batches por correção** (cada frente com tripé: guard + negative-proof que morde + E2E/prova).
**Batch 1** entrega o vazamento URGENTE + os locks de tombstone/stub. Parent `b6f08e91` · branch `rescue-structural` ·
dev **385/385** (sem migration neste batch).

## B4f — `daily-metrics` escopo por tenant (vazamento cross-tenant FECHADO)

**Bug ativo:** `src/core/dashboard/daily-metrics.service.ts` rodava `pool.query` SEM `tenant_id` →
qualquer autenticado lia agregados **platform-wide** (events/event_organizers/organizer_subscriptions/event_metrics
de TODOS os tenants). "TODO admin" nunca implementado.
**Patch:** service reescrito — toda query filtra `tenant_id` (server-side, via `req.tenant.id`); rota
(`daily-metrics.routes.ts`) exige `req.tenant.id` (400 fail-closed) e passa a ambos os métodos. _(Bônus: 3 nomes de
coluna defasados que tornavam o service inexecutável foram corrigidos — `current_period_end`→`ends_at`, `type`→
`metric_type`; o endpoint estava 500 latente.)_
**Tripé:** guard `audit-dashboard-metrics-tenant-scope.mjs` (cada FROM tenant-scoped exige `tenant_id`; rota passa
`req.tenant.id`) · negative-proof (remove filtro tenant_id da query / rota sem `req.tenant.id` → morde; restauração
byte-idêntica) · E2E efêmero **4/4** (tenant A vê SÓ seus organizers/events, não A+B; simétrico p/ B; guard verde).

## F1 + F2 — locks de stub RBAC + tombstones

**F1 (swap do stub travado):** `actor_has_permission` é o STUB FAIL-CLOSED (`RETURN FALSE`, FASE 6 dormente sobre 8
roles/76 perms semeados). O risco real é **ligar a FASE 6** (trocar o stub por implementação que lê os legados como
autoridade viva — PORTA-2, ato soberano). O guard verifica a definição **EFETIVA** (migration de maior timestamp que
define a função): deve ser `RETURN FALSE`, sem `RETURN TRUE`. _(Def histórica `20260421010000` = `RETURN TRUE` dev-stub,
SUPERADA por `20260422000100` fail-closed — só a efetiva conta.)_
**F2 (tombstones não ressuscitam):** `organization_members` e `user_identity_links` = AUSENTES no schema vivo
(to_regclass NULL). O guard FALHA se qualquer migration CRIAR essas tabelas (08 §10.2 / 0130 D1/D11). O repositório morto
`organization-member.repository.ts` (INSERTs sobre tabela ausente) é baseline inerte — o guard protege contra a
RESSURREIÇÃO (CREATE TABLE), não contra o código morto.
**Tripé:** guard `audit-rbac-stub-and-tombstones.mjs` · negative-proof (swap p/ `RETURN TRUE` / `CREATE TABLE
organization_members` → morde; restauração byte-idêntica). _(Sem E2E: invariantes estáticos sobre migrations.)_

## Gates (batch 1)

| Prova | Resultado |
| --- | --- |
| e2e dashboard-metrics (efêmero) | **4/4** (isolamento A≠B) |
| neg-proof dashboard-metrics | 2 mordidas; byte-idêntico |
| neg-proof rbac-stub-and-tombstones | 2 mordidas (swap + ressurreição); byte-idêntico |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0; +2 guards novos) |
| arch --strict | `critical_new=0` |
| tsc backend | **25** (zero erro nos arquivos tocados) |

## Hard stops respeitados

Sem gated tocado · sem seed (PORTA-1/2/3) · sem RLS · sem RBAC ligado · sem delegação viva · sem platform · sem cartão ·
sem Core financeiro tocado · dev 385/385 (batch sem migration). Stub `actor_has_permission` permanece `RETURN FALSE`;
tombstones permanecem ausentes.

## Estado da onda (restantes — findings de 1ª mão, próximos batches com tripé)

- **A1** higiene cartorial (header LOG "0116", §10.2 citation, index): docs, frente própria — NÃO toquei `DECISOES.md`
  (memória de especialista, pré-modificada).
- **B1f** estender gate 0113: **JÁ FECHADO de fato** — business-audit/policy-engine já em SAFE_SUBJECT_READERS (Forma C);
  reporting sem canal client-declared (Forma D). "Classic readers 7→3" já realizado por frentes R2 anteriores. Verificar +
  documentar (provável no-op-com-prova).
- **B2f** sweep `actionContext`/canal-1 em event.routes (MONEY): **2 rotas money UNBOUND** achadas (POST `.../economic/v2/
  custody` lê `body.economic_owner_id`; POST `.../economic/v2/split` lê `body.parts[].target_id`) — sem `userRepresentsActor`
  visível. **STOP do GO respeitado:** classificar, NÃO concluir seguro sem provar o gate service-level (eventCustodyService/
  eventSplitDeclarativeService). Frente própria CRÍTICA (money) — verificar o service e BINDAR ou conter.
- **B3f** `groups/mine`: múltiplos usos de `actionContext.actorId` em `groups.routes.ts` (94/98/124/377/445); um já foi
  corrigido (comment 217-222). Frente própria (bug+design; trocar fonte p/ `req.user.userId`).
- **C4** rastro de operador no reversal: migration aditiva `20260614160000` (`initiated_by_user_id`/`initiated_authority_id`
  nullable; INSERT intocado; CHECK `chk_external_reversal_is_systemic` preservado). Pronta — frente própria com migration.
- **E1** citar `availability-owner-authority` (0118 D2) como exemplar: doc.
- **E2** selar C63 tombstone temporal: verificar REVOKE `20260428200000` aplicado + DT.
- **F3** `actor_has_any_role`: **NÃO é tombstone dormente** — está RESTAURADO e LIVE (rbac.service.ts:210 + 7 callers de
  `userHasAnyRole` lendo `user_roles` como autoridade). Guard de tombstone seria inadequado. **Reclassificado:** é
  superfície "role≠autoridade" (Art.17 / ADAPTADOR_TRANSITÓRIO T1/T3) — frente de contenção própria, não one-liner.

## Estado

PRIMEIRA ONDA — BATCH 1 **IMPLEMENTED / HOLD PARA RESEAL**. B4f (vazamento cross-tenant fechado) + F1/F2 (locks stub/
tombstone) com tripé. Restantes scoped com findings; cada um vira batch próprio com tripé. dev 385; baseline 0113=0;
Core financeiro/executor/worker/bridge intocados.
