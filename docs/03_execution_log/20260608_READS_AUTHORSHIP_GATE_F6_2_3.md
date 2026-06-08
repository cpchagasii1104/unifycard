# Execução — F-READS-AUTHORSHIP-GATE-F6_2_3 (DECISION-0113 fatia 6.2+6.3) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `77cd8a0f`
**Decisor:** Clayton ("pode executar; siga as normas") · **Esteira:** eu (escritora); par verifica.

## Objetivo
Continuar a fatia 6 (leitura cross-user) pelos reads não-financeiros: **F6.2** `identity GET /identity/configurations` (self) + **F6.3** os 3 agregadores `/me/*` (canRepresentActor).

## Implementação (backend; 4 arquivos de rota; sem migration/Bank/frontend)
- **F6.2 — `identity GET /identity/configurations` (self):** o `userType` (PF/PJ) é a identidade do **próprio caller**. Substituída a resolução `findById(req.actionContext.actorId) → user_id → globalUserId` por `callerGlobalUserId = req.user.globalUserId ?? await resolveGlobalUserId(req.user.userId, req.tenant.id)` — **espelha o PUT da fatia 5.1**. Padrão **self**, não `canRepresentActor` (entitlement/identidade do caller, não agir-como-outro).
- **F6.3 — `/me/*` agregadores (canRepresentActor):** `/me/active-location` (geo lat/lng), `/me/impact-overview`, `/me/pending-responsibilities` ganham, após a validação de `actionContext`, o gate fail-closed:
  ```ts
  let canRead… = false;
  try { const { authorizationService } = await import('@core/authorization/authorization.service');
    canRead… = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId); }
  catch { canRead… = false; }
  if (!canRead…) return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
  ```
  **antes** de qualquer leitura. Actor-keyed (o caller pode ler o `/me/` de um actor representável: empresa/grupo/delegação).

## Os três padrões da fatia 6 (consolidação)
1. **self** (config GET) — sujeito = `req.user`; espelha 5.1.
2. **actor-keyed na própria rota** (money reads F6.1 + `/me/*` F6.3) — `canRepresentActor` inline antes do read.
3. **cross-user no caller** (`getCompleteProfile`, F6.4) — gate no caller layer; frente de **desenho**, não mecânica (ver STOP).

## Prova
- **e2e novo** `validate-pipeline-e2e-reads-authorship-f6-2-3` **8/8**: **A behavioral** primitivo nega cross-user (dev/estranho); **B estrutural F6.2** GET /configurations resolve de `req.user` e **não** via `findById(actionContext.actorId)` (slice do handler GET); **C estrutural F6.3** gate antes da leitura nos 3 handlers + assinatura canônica.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3; dev **365**).
- **Sem regressão:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8.

## STOP — F6.4 exige envelope (não mecânica)
`core.service.getCompleteProfile(tenantId, userId)` é chamado por **groups** (`groups.routes.ts:234`) e **social** (`social-2.0.service.ts:301`) com `userId` de **terceiro** → vazamento cross-user está no **caller layer**, não numa rota única. O gate precisa ir onde o caller pede o perfil de outrem, e há **possível decisão de produto** (visualizar perfil alheio é permitido? com que redação de campos sensíveis — lifestyle?). Farei **READ-FIRST + envelope** antes de codar.

## DTs
- `DT-CROSS-USER-READ-ACTORID-UNVALIDATED` segue **PARTIALLY MITIGATED** (F6.1+F6.2+F6.3 fechadas). **DT-mãe OPEN** (fecha só com F6.4).

## Próximo passo
Envelope **F6.4** (`getCompleteProfile` cross-user) → execução → só então a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` fecha e o arco DECISION-0113 está completo.
