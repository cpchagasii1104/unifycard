# Execução — F-GROUPS-CREATE-SELF-AUTHORSHIP-F6_4 (DECISION-0113 fatia 6.4 — fecha o arco) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `da7f1377`
**Decisor:** Clayton (GO "fix unificado self" após STOP da executora) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar a última superfície da fatia 6 (`getCompleteProfile` cross-user) e, com ela, o arco DECISION-0113.

## READ-FIRST (redefiniu o problema)
Tracei os 4 callers de `coreService.getCompleteProfile`:
- `core.routes.ts:75` (`GET /profile`) → `req.user.userId` → **self**.
- `profile.routes.ts:377` (`GET /progress` → `calculateProfileProgress`) → `req.user.userId` → **self**.
- `social-2.0.service.ts:301` (feed) → `user.user_id` derivado do `globalUserId` do caller → **self**.
- `groups.routes.ts:234` → `userId` de **`actionContext.actorId`** (spoofável) → ⚠️ único furo.

**Conclusão 1:** `getCompleteProfile` é cross-user-**capaz** mas nenhum caller lê perfil alheio → **não há leitura cross-user de perfil em produção** (o alerta da F5.3 estava superdimensionado).
**Conclusão 2 (pior que leitura):** no `POST /groups`, o `userId` spoofável alimentava **DOIS** caminhos no mesmo handler — o gate `identity_status` (read) **e** `groupsService.createGroup(tenantId, userId, …)` (**write**) → um caller declarava o `actorId` de uma vítima e **criava grupo em nome dela** (escalonamento de autoridade em escrita).

## STOP → decisão Clayton
A executora **parou** (write-authority ultrapassa o envelope de *reads*; "executora não se autoriza"). Clayton: **GO fix unificado self** — corrigir read **e** write juntos; não separar ("separar = porta aberta com plaquinha 'volto já'"). Regra: criação de grupo é **self** → sujeito = `req.user.userId`; sem caller resolvível → fail-closed; nunca fallback ao `actionContext.actorId`. (Clayton pediu reler `Cleiton.md` — atualizado com o norte do sistema + item #1: gate de gênero no mesmo handler, **A VERIFICAR** — NÃO alterado aqui.)

## Implementação (backend; 1 arquivo de rota; sem migration/Bank/frontend)
`modules/groups/groups.routes.ts` (`POST /groups`): removida a resolução `findById(actionContext.actorId) → actor.user_id`; `userId = req.user.userId` (self); `if (!req.user?.userId) → 401`. O **mesmo `userId` self** alimenta `getCompleteProfile` (gate identity_status) e `createGroup` (write). `actionContext` segue exigido pelo contrato V2 mas **não é fonte de autoridade**. (O `preHandler requirePermission` da fatia 1 já exigia representabilidade, mas representabilidade ≠ self: quem representa B poderia criar grupo como B — self é o correto.)

## Prova
- **e2e novo** `validate-pipeline-e2e-groups-create-self-authorship-f6-4` **10/10**: **B** estrutural (`userId` de `req.user.userId`, não de `actor.user_id`/`findById(actionContext.actorId)`; mesmo userId no read e no write; 401 fail-closed); **C** os 4 callers de `getCompleteProfile` são self → nenhuma leitura de perfil alheio; **D** sanidade do caller real.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3; dev **365**).
- **Sem regressão:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8.

## O que NÃO foi tocado
Lógica de gênero/`identity_status` (`Cleiton.md` item #1) · permissões/cargos de grupo · `canActAs`/`checkOwnership` · lifestyle/profile-C1/plan/identity · money latente · Bank · migration · frontend · `docs/memorias/`/autorais.

## DTs
- `DT-GROUPS-CREATE-ACTOR-SPOOF` — aberta+**CLOSED** nesta fatia.
- `DT-CROSS-USER-READ-ACTORID-UNVALIDATED` → **CLOSED** (F6.1+6.2+6.3+6.4).
- **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → CLOSED (superfícies vivas) / RESÍDUO-DIFERIDO:** fatias 1/2/3/5/6 DONE; nenhuma rota viva keyed em `actionContext.actorId` sem gate. Resíduo único = **money LATENTE (fatia 4)**, inerte (Proxy reject-all), cobrança em `DT-MONEY-LATENT-REACTIVATION-TRAP` (OPEN). _(Fechamento aguarda ratificação Clayton/Yala; reabrível.)_

## 🏁 Arco DECISION-0113
**COMPLETO nas superfícies vivas.** `actionContext.actorId` deixou de ser autoridade em toda rota viva: RBAC, membros/org, money LIVE, plan/identity (self), profile-C1, lifestyle/LGPD, leituras cross-user (money/config/`/me/*`/groups). Autoridade = `req.user` + `canRepresentActor`/`canManageCompany`/self; autoria de audit = server-side.

## Próximo passo (espera go)
Nada pendente neste arco. Candidatos (`Cleiton.md`): loops abertos (PJ operar PJ-1/PJ-2; delegação AUTH-1/AUTH-2; autogestão AUTG-1), ou o money-latente ao ser religado (com gate no mesmo corte).
