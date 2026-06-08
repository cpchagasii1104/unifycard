# Execução — F6.5-CANAL3-A-CULTURAL (DECISION-0113, canal 3 não-money) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA (classificação READ-FIRST + micro-fatia A) · **Branch:** `rescue-structural` · **HEAD origem:** `0ca989b7`
**Decisor:** Clayton (classificar antes de mexer; autorizar só o A claro) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Classificar o canal-3 **não-money** de 1ª mão e gatear **somente** o A privado claro (`cultural /profiles`), preservando os B públicos e deixando compliance (F) para decisão própria.

## Classificação READ-FIRST (1ª mão — relatório entregue à diretora)
- **B público (NÃO gatear — quebra descoberta/confiança; norte Cleiton.md):** `social-2.0 /impact/balance` (impact_balances = score social, **não bank**), `/reputation/permissions` (reputation_level/diversity_score — sinal público), `marketplace-categories /root-filtered` (catálogo), `public-profiles ?actorId` (perfis públicos).
- **A privado (gateado):** `cultural /profiles?owner_actor_id`.
- **F compliance/admin (decisão Clayton — role-admin, NÃO canRepresentActor):** `trust /trust/profile/:actorId` + `/trust/profiles` (risco/anti-fraude, **atualmente NU**, cross-actor por design; liga ao R2.4 risco); `policy /policy-decisions?actorId` (confirmar `requirePolicyPermission`). `business-audit /business-audit-logs?actorId` = **F já gateado correto** (`requirePermission(['admin:view_audit_logs'])`) — NÃO tocar.
- **D writes:** `trust /recalculate/:actorId`, `/trust/events`, `/can-proceed` → DT própria.
- **G inconclusivo/deferido:** `social-2.0 /impact/ledger` (extrato detalhado — decisão transparência vs privado); `events-spec /event-specs?actor_id` (sem `req.user` → tratar com F6.5.6b events).

## Implementação (backend; 1 arquivo; sem Bank/migration/frontend/write)
`cultural /profiles?owner_actor_id`: `owner_actor_id` é **obrigatório** (400 se ausente — sem caminho alternativo). Adicionado, após o 400, antes de `culturalProfileService.listProfilesByActor`: `canRepresentActor(req.tenant.id, req.user.userId, ownerActorId)` fail-closed (401 sem caller; 403 não-leak). Os PACs são do **dono** ("do ator ativo") → o `req.user` precisa representar o owner filtrado. `GET /cultural/profiles/:id` (params id = **canal 5**) **NÃO** tocado (fora do escopo desta micro-fatia).

## Prova
- **e2e novo** `validate-pipeline-e2e-cultural-profiles-authority-f6-5-c3a` **7/7**: **A** behavioral REAL (canRepresentActor nega cross-user — dev próprio=true / estranho=false); **B** estrutural gate-antes-da-leitura sobre o **owner FILTRADO** (`ownerActorId`, não só o actor do caller) + 401/403 fail-closed; **C** escopo (só /profiles; /:id params e os B intocados).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**). Núcleo + canal-3 money intactos (regressões verdes: rbac 13/13 · money-live 12/12 · ledger 7/7 · x-actor-id 9/9 · canal3-money 7/7 · service-order 11/11).
- **Só `cultural.routes.ts` no diff** — B públicos / trust / policy / impact / events-spec intocados (confirmado por `git status`).

## O que NÃO foi tocado
B públicos (impact/reputation/marketplace-categories/public-profiles) · trust (F, role-admin pendente) · policy · impact/ledger (G) · events-spec (→ F6.5.6b) · `/cultural/profiles/:id` (canal 5) · writes · Bank/ledger · R2 · migration · frontend.

## DTs
- `DT-DIRECT-QUERY-ACTOR-READERS-UNVALIDATED`: classificação não-money concluída; **A cultural DONE**; F trust/policy = decisão Clayton; G deferidos. **DT-mãe OPEN (não fechada).**

## Próximo passo (espera go)
Decisão Clayton sobre os **F (trust/policy = role-admin?)** + os **G** (impact/ledger; event-specs→F6.5.6b) + o **canal 5** (params `id`); depois F6.5.6b events → 6.5.7/8/9 → selo final Yala (grep dos 5 canais).
