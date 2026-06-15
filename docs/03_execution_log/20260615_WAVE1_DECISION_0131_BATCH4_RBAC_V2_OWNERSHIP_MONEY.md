# 2026-06-15 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 4 (F-RBAC-V2-PERMISSION-OWNERSHIP, money-first)

Pós-PASS Yala do re-reseal de BATCH 3 (commit `8cd5daa9`). **B4** — escopo ESTREITO: corrigir a superfície MONEY
`GET /social/work/posts/:postId/payments` (DIVERGENT-MONEY) para autoridade canônica por ownership, ANTES de qualquer
role. Parent `8cd5daa9` · branch `rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST (1ª mão)

- **Rota:** `GET /social/work/posts/:postId/payments` (lista pagamentos do job do post). **READ money-audit** (hoje
  retorna `payments: []` — TODO stub; o listing real é aspiracional).
- **Autoridade ANTES:** `preHandler requirePermission(['economy:transaction:read','social:post:read'])` (RBAC-V2,
  role-based → rbac.plugin → `actorHasAnyRole` → `actor_has_any_role` → `user_roles`) **+** inline
  `rbacService.userHasAnyRole(['admin','owner'])`. **Role-solo (DIVERGENT-MONEY):** o dono do post SEM role era barrado
  pelo preHandler; um portador de role via tudo. Nenhuma autoridade de ownership.
- **Primitivo canônico — descoberta crítica:** `socialService.getPost` está **DEFASADO/QUEBRADO** (seu SQL faz
  `SELECT post_id, ..., global_user_id FROM posts WHERE post_id=$1`, mas `posts` no schema atual é **actor-based**:
  `id`/`actor_id`, **sem** `post_id`/`global_user_id` → `coluna post_id não existe`). `validatePostAccess` (que usa
  getPost) também está quebrado. ⇒ NÃO usei getPost. O primitivo canônico correto e VIVO: ler `posts.actor_id` (autor)
  e exigir `authorizationService.canRepresentActor(tenantId, req.user.id, postActorId)`.

## Correção (menor correção segura)

- **`src/modules/social/social-work-payment.routes.ts` (GET payments):**
  - **REMOVIDO** o `preHandler requirePermission([...])` (role-only) e o inline `userHasAnyRole`.
  - **ADICIONADO** gate canônico ANTES de qualquer side-effect: `SELECT actor_id FROM posts WHERE id=$1 AND
    tenant_id=$2` (404 se ausente) → `canRepresentActor(tenantId, req.user.id, postActorId)` → **403 fail-closed** se
    não representa. **SEM role-fallback.** Import `rbacService` trocado por `pool` + `authorizationService`.
  - _(POST `/pay` — money WRITE — fora deste escopo estreito; segue com `requirePermission`; ver Ressalvas.)_

## Classificação (antes → depois)

`social-work-payment` GET payments: **DIVERGENT-MONEY (role-solo) → CANÔNICO-OWNERSHIP (canRepresentActor, SEM
role-fallback)**. Removido do registro de callers de role do guard de contenção (não chama mais userHasAnyRole). _(Não
é ADAPTER nem CONTIDO — é canônico: a decisão NÃO depende de role.)_

## Provas (tripé)

- **Guard NOVO** `audit-social-work-payment-ownership.mjs` (no `validate:regression-guards`): FALHA se a rota GET
  payments voltar a usar `userHasAnyRole`/`actorHasAnyRole`, voltar a ter `requirePermission`, ou perder o gate canônico
  (`FROM posts` + `postActorId` + `canRepresentActor` + 403).
- **Containment guard** `audit-role-as-authority-containment.mjs`: social-work-payment removido do registro (7 callers:
  4 ADAPTER_TRANSITIONAL + 3 DIVERGENT).
- **Negative-proof** `negative-proof-social-work-payment-ownership.ps1`: (a) role-solo de volta · (b) requirePermission
  de volta · (c) remover canRepresentActor → guard FALHA nos 3; restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-social-work-payment-ownership.ts` (DB efêmera, social ports, stub-auth, **zero
  dinheiro**): **5/5** — T1 Alice(representa o autor)→passa o gate (≠403) · T2 Bob(não-representa)→**403** · T3 Bob COM
  role admin semeada→**AINDA 403** (role não autoriza money) · T4 Bank intocado · T5 guard verde.

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **5/5** |
| negative-proof | 3 mordidas; byte-idêntico |
| social-work-payment-ownership guard | GATE OK |
| role-as-authority-containment guard | GATE OK (payment removido; 7 callers) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0; +1 guard) |
| arch --strict | `critical_new=0` |
| tsc | build **25** (zero atribuível) · strict **43** (baseline herdado) |

## Hard stops respeitados

NÃO reescreveu RBAC-V2 inteiro · NÃO ativou RBAC · stub `actor_has_permission`=RETURN FALSE intacto · NÃO ligou FASE 6 ·
sem cargo/mapper/RLS/`financial_approval_*`/Bank/seed/delegação/platform/cartão · NÃO mexeu em apply/schedule/categories
nem nos 4 ADAPTER_TRANSITIONAL · NÃO tocou C4/B3f/A1/E1/E2/B1f. Bank intocado; dev 385/385. Ownership ANTES do role;
`user_roles`/role não autoriza money.

## Riscos remanescentes (DT)

- **POST `/social/work/posts/:postId/pay`** (money WRITE) segue com `requirePermission` role-based — **fora do escopo
  estreito do B4** (era GET payments). Frente própria.
- **apply/schedule** (DIVERGENT) + **categories** (DIVERGENT-CONFIG) seguem em DT (sub-frentes); os 4 ADAPTER_TRANSITIONAL
  seguem em DT de convergência.
- **`socialService.getPost` + `resolveJobFromPost` defasados** (SQL com post_id/global_user_id inexistentes) — a feature
  social-work-from-post é aspiracional/quebrada; meu gate não depende deles (lê posts.actor_id direto). DT de schema-drift.

## Estado

WAVE-1 BATCH-4 **IMPLEMENTED / HOLD PARA RESEAL**. `GET payments` (money) deixou de depender de role-solo: autoridade
canônica por `canRepresentActor` sobre o actor autor do post, fail-closed; role não autoriza (e2e prova). dev 385;
baseline 0113=0; Bank/Core intocados; RBAC-V2 não reescrito. Restantes: POST /pay, apply/schedule/categories, adapters,
C4/B3f/A1/E1/E2/B1f — frentes próprias.
