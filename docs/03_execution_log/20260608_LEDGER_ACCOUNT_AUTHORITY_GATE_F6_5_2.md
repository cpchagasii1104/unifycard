# Execução — F-LEDGER-ACCOUNT-AUTHORITY-GATE-F6_5_2 (DECISION-0113 fatia 6.5.2 — money) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `8a6887dd`
**Decisor:** Clayton (Opção 1 com trava forte, após STOP no fork non-actor) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar o IDOR financeiro no cluster ledger (leitura). Substrato sensível (cofre) → READ-FIRST obrigatório + fix cirúrgico.

## READ-FIRST (ledger.routes.ts inteiro + modelo de conta)
- 3 GET: `/ledger/accounts/:accountId/balance` (params.accountId → `calculateBalance` = **IDOR**); `/ledger/entries` (accountId/contextId/list-all por query, **A**); `/ledger/context/:type/:id` (**501** dead).
- `requireLedgerPermission` **CONFIRMADO gate falso**: só seta `accessLevel='limited'|'full'`, **nunca bloqueia**; a única trava ('limited' exige contextId) **não checa dono do contextId**.
- Modelo: `bank_accounts.owner_type IN ('actor','system','escrow')`; `bankAccountRepository.getAccountById` resolve `{ownerType('user'|'system'|'escrow'), actorId, ownerId}`. → **contas non-actor existem** (dinheiro de plataforma/custódia).

## Fork + decisão (STOP do Clayton honrado)
Como contas non-actor existem, o GO embutiu STOP. Perguntei (AskUserQuestion). **Clayton: Opção 1 com trava forte** — actor-owned agora (canRepresentActor no dono real); non-actor exige **gate admin bloqueante real preso em `req.user`** (NÃO o `requireLedgerPermission` falso); **sem gate real reaproveitável → fail-closed 403 + registrar STOP, não simular.**
Investiguei o gate admin: `fastify.requirePermission`/`requireRole` (fatia 1) são reais e bloqueantes, MAS **intent/scope-acoplados** (RBAC V2) — wirá-los inline num branch admin condicional de leitura financeira não é cravável sem auditar o modelo de intent/scope; `hasAnyPermission` é actor-scoped (gameável). → **Sem gate admin limpo reaproveitável** → fail-closed + DT.

## Implementação (backend; 1 arquivo; zero Bank-write/migration/schema/frontend)
Helper `assertLedgerAccountAuthority(req, reply, tenantId, accountId)`:
- `req.user.userId` ausente → 401.
- `getAccountById` → `!account || ownerType !== 'user' || !actorId` → **403 não-leak** (system/escrow/sem-actor/inexistente uniformes).
- actor-owned → `canRepresentActor(tenantId, req.user.userId, account.actorId)` → false → 403.
Aplicado em **balance** (antes de `calculateBalance`) e **entries** (antes de `getEntriesByAccount`). `entries` **sem accountId** (list-all/by-contextId) → **403 fail-closed**. Removidos `ForbiddenError`/`LedgerRequest` órfãos.

## Padrão de gate (classificação F6.5.0)
- actor-owned balance/entries-by-accountId = **OWN-PARAMS** (conta da URL → dono real → canRepresentActor).
- non-actor / list-all / by-contextId = **fail-closed 403** (gate admin real = frente própria).

## Prova
- **e2e novo** `validate-pipeline-e2e-ledger-account-authority-f6-5-2` **7/7**: **A** behavioral primitivo nega cross-user; **B** behavioral por conta **N/A** (DEV carteira lazy = 0 `bank_accounts`, `Cleiton.md` BANK-1 — reportado transparente, **não fake-green**); **C** estrutural gate-antes-da-leitura nos 2 reads + list-all 403 + helper `getAccountById`+`canRepresentActor` + non-actor fail-closed.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (**bank-ledger §4.6 verde** — zero `bank_*` novo; dev **365**).
- **Núcleo 0113 + F6.5.1 intactos:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8.

## O que NÃO foi tocado
Bank **writes** · schema/migration · modelo Fundo Regional/AP-AR (0114, congelado) · money latente · feed · inbox · commitments · contextual-thread · events · service-order · R2 · frontend.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` OPEN (F6.5.2 fechada).
- **`DT-LEDGER-ADMIN-READ-GATE-MISSING` OPEN (nova):** gate admin bloqueante real para leitura agregada/system do ledger — fail-closed até existir (não é vazamento; é reporting indisponível). DT-mãe OPEN.

## Próximo passo (espera go)
**F6.5.3 — contextual-thread** (mensagens privadas por threadId/contextId; OWN-PARAMS/participante). Depois 6.5.4 feed → … → 6.5.9 ERP/marketplace.
