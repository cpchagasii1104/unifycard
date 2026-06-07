# Execução — F-AUTHORIZATION-CAN-REPRESENT-ACTOR-PRIMITIVE + F-RBAC-PLUGIN-BIND-REQ-USER (DECISION-0113 fatia 1/6)

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `bdd97a37`
**Decisor:** Clayton/ChatGPT (Opção A do STOP) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar o **amplificador sistêmico** de spoofability: `rbac.plugin` decidia role/permission só com o `actionContext.actorId` declarado (spoofável) — `requireRole(['admin'])` bypassável. Bindar `req.user` antes do lookup, via um primitivo de **representabilidade** registry-independente.

## READ-FIRST + pré-check (STOP anterior resolvido)
- `canActAs(...)` exige `PermissionKey` (vocabulário ≠ do rbac) e sua trilha de empresa depende de `actor_registry` (populado lazy — único call-site `company-members.service:84`). → **STOP** pedindo decisão; Clayton autorizou **Opção A** (primitivo novo).
- `req.user.id` = `users.id` (confirmado em `require-permission.guard:48`); `actors.user_id` guarda `users.id`; `company_users` usa `global_user_id` (resolvido por `resolveGlobalUserId`).
- `actor_delegations`: ativa ⇔ `status='active' AND (expires_at IS NULL OR expires_at > NOW())` (`findActiveDelegation` reusado).

## Implementação (backend, sem migration)
1. **`authorization.service.ts`** — novo método público **`canRepresentActor(tenantId, userId, actorId): Promise<boolean>`**, permission-agnóstico e registry-independente:
   1. ownership direto `actors.user_id===userId` (user/actor_human/person);
   2. **empresa via `companiesService.canManageCompany`** (canônico `can_manage_company OR role='owner'`, import dinâmico p/ evitar ciclo) — **NÃO** `checkOwnership` legado;
   3. grupo via `actors.group_id` → `checkOwnership('groups')`;
   4. registry-bônus (quando houver linha) → cobre ex.: events;
   5. delegação ativa via `findActiveDelegation`.
   + helpers privados `safeResolveGlobalUserId` (principal desconhecido → null, fail-closed) e `safeCheckOwnership` (erro → false).
2. **`rbac.plugin.ts`** — helper `assertActorRepresentable(req, op)` chamado **antes** do lookup nos 3 decorators (`requirePermission`/`requireAnyPermission`/`requireRole`): sem `req.user.id`→401; `canRepresentActor`=false ou throw→403 fail-closed. Lookup de role/permission inalterado depois do gate. `actionContext` não vira actor inferido; não removido.

## Achado material (registrado)
`checkOwnership` (usado por `canActAs` trilha-2) reconhece só `is_primary=true`/`role='admin'` e **ignora o dono `role='owner'`+`can_manage_company`** — `canActAs` negaria o próprio dono da empresa agindo via page-actor (entity-ownership). Por isso o primitivo usa `canManageCompany`. O gap do `canActAs` é **dívida pré-existente própria** → `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` (aberta, fora desta fatia).

## Prova
- **e2e** `validate-pipeline-e2e-rbac-actor-binding` **13/13**: R1 ownership→true · R2 spoof(principal estranho)→false · R3 empresa legítima→true · **R3b registry-INDEPENDENTE (actor_registry sem linha)** · R4 spoof-empresa→false · R5 sem-vínculo→false · R6 delegação ativa→true · R7 expirada→false · R8 revogada→false · R9 fail-closed (inputs vazios + actor inexistente) · R10 estrutural (binding antes do lookup nos 3 decorators; usa canRepresentActor+forbidden).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3). **dev 365** (zero migration/Bank/frontend/middleware-central).
- **Regressões:** 7 DEV-safe verdes (admin-review 13/13, release-gate 10/10, vocab 7/7, projection 4/4, cnpj 6/6, lifecycle 7/7, user-submit 19/19). Ephemeral: adminoverride **5/5**, kyb-revocation-cascade **15/15**. 3 ephemeral (kyb-gate/social-kyb-gate/kyb-writer) falham no **setup** (`chk_companies_company_status_lifecycle`/min-docs) — **pré-existente**, confirmado via `git stash` (falham idêntico sem a mudança).

## O que NÃO foi tocado
`canActAs`/`checkOwnership` (corpos inalterados) · middleware central · rotas money-live · company-members/organization · KYB/fiscal/lifecycle · Bank/`bank_*` · migration · frontend · provider storage/scanner · ACTIVE writer · `docs/memorias/`/autorais.

## DTs
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **fatia 1/6 DONE**, segue OPEN (fatias 2–6).
- `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` → **OPEN** (nova; dívida pré-existente do `canActAs`).

## Próximo passo
`F-AUTHORITY-ESCALATION-GATE` (company-members + organization juntos — mint de `actor_delegations` escopo `['*']`).
