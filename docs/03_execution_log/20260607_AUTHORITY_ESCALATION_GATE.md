# Execução — F-AUTHORITY-ESCALATION-GATE (DECISION-0113 fatia 2/6)

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `2d35c91a`
**Decisor:** Clayton/ChatGPT · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar a **fábrica de crachá falso**: rotas de `company-members` + `organization` que criam/alteram membros, convites, roles e delegações (mint de `actor_delegations`, inclusive escopo `['*']`) devem provar autoridade **server-side** antes de qualquer mutação.

## READ-FIRST + respostas ao pré-edit
- **company-members.routes** (POST/PUT/DELETE `/:companyId/members[/:memberId]`): passavam `actionContext.actorId` ao service, **sem gate**. `company-members.service.createMember` recebe `userId` mas **nunca o usa para authz** — valida só que `input.actorId` é 'user' — e `createDelegationForMember` minta `actor_delegations` com `getScopesForRole(role)`: **admin → `['*']`**. Primitiva de escalonamento aberta.
- **organization.routes** (invites create/accept/revoke; members role/remove): passavam `actionContext.actorId` (em ambos os params). Os services **JÁ têm** autoridade — `validateCanInvite`/`validateCanManageMembers` exigem OWNER/ADMIN via `getMemberByUser(userId, actorId)` — mas keyed no `actorId` **spoofável** (correção ao inventário: invites **não** estavam sem gate). Organization é wired (`app.builder:664`).
- Gate canônico de empresa: `companiesService.canManageCompany(tenantId, companyId, globalUserId)` (`can_manage_company OR role='owner'`). `req.user.id`→`globalUserId` via `resolveGlobalUserId`.
- **Sem STOP:** ambos os subsistemas têm modelo de autoridade canônico claro.

## Implementação (backend, só 2 arquivos de rota; sem migration/service-logic)
1. **`company-members.routes.ts`** — helper `requireCompanyManage(req, reply, companyId)` (fail-closed: sem `req.user.id`→401; sem global_user_id→403; sem `canManageCompany`→403). Aplicado: **POST** sobre `req.params.companyId`; **PUT/DELETE** sobre a **empresa REAL do membro** (`getMember(memberId).companyId`) → fecha IDOR cross-company (o service opera por `memberId` sem checar companyId).
2. **`organization.routes.ts`** — helper `requireRepresentable(req, reply, actorId)` → `authorizationService.canRepresentActor(req.user.id, actorId)`. Aplicado **antes** do service em: `POST /invites` (actorId), `/invites/:id/accept` (`req.body.actorId` — o aceitante só vincula actor que representa), `/invites/:id/revoke`, `/members/:id/role`, `/members/:id/remove`. Os checks OWNER/ADMIN dos services passam a rodar sobre actor **provado**.

> Padrão da fatia: o defeito era **input spoofável num check correto**, não ausência de check → o fix é **bindar o actor ao principal** (representabilidade), preservando a autoridade OWNER/ADMIN/canManageCompany já existente. Services **intocados**.

## Prova
- **e2e** `validate-pipeline-e2e-authority-escalation-gate` **16/16**: A1 canManageCompany(dono)→true · A2 (estranho)→false · A3 canRepresentActor(dono,page-actor)→true · A4 (estranho)→false · B1a/b/c company-members gate antes de create/update/removeMember · B2a–e organization gate antes de inviteUser/acceptInvite/revokeInvite/changeRole/removeMember · C1a/b OWNER/ADMIN intacto (`validateCanInvite`/`validateCanManageMembers`) · C2 escalação `['*']` (admin) documentada e atrás do gate.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3). **dev 365** (zero migration/Bank/frontend/middleware-central).
- **Regressões:** rbac-actor-binding **13/13** + 7 DEV-safe verdes (vocab 7/7, projection 4/4, cnpj 6/6, admin-review 13/13, release-gate 10/10, lifecycle 7/7, user-submit 19/19); ephemeral company-status-lifecycle **13/13**; atomic-company-birth **17/18** (1 falha `1d company PROVISIONAL/pending` **pré-existente**, confirmada via `git stash` → `DT-PJ-EPHEMERAL-FIXTURES-STALE-VS-BASELINE-365`).

## O que NÃO foi tocado
Services de company-members/organization (lógica de autoridade intacta) · middleware central · rotas money-live · KYB/fiscal/lifecycle · Bank/`bank_*` · migration · frontend · schema · `actor_delegations` (schema) · `canActAs`/`checkOwnership` · `docs/memorias/`/autorais.

## DTs
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **fatia 2/6 DONE**, OPEN (fatias 3–6).
- `DT-PJ-EPHEMERAL-FIXTURES-STALE-VS-BASELINE-365` → **OPEN** (resíduo separado; não-regressão).

## Próximo passo
Fatia 3/6 — **money LIVE** (`unifycard` authorize/capture/settle · `settlement`/region credit-debit · `accounts-payable`/`accounts-receivable` · `payment-method`/`unifycard-method`), com suite financeira completa + double-entry a cada fatia e stop ao primeiro vermelho.
