# 2026-06-17 — F-ACTOR-REFERRAL-CODE-SUBSTRATE (material)

Materializa o **referral ACTOR-SCOPED** conforme `DECISION-0139`: o código de indicação e seus
earnings pertencem ECONOMICAMENTE ao `owner_actor_id` (não ao CPF/user por reflexo); `referral_code`
= lookup, **nunca authority**; body/metadata não define dono; `actor_system` é fail-closed; earnings →
`actor_wallet` do owner. **Zero Bank Core / zero bank_ledger / zero bank_splits schema.**

## Anchor / Pré-flight

HEAD inicial `1e006f95` (== anchor das auditorias A/B/C **e** do Yala PASS docs-only de DECISION-0139,
satisfeito pelo handoff da IA Diretora — desbloqueio opção 2). Branch `rescue-structural`. Sem sujeira material
em referral/auth/actor/bank. Migrations 393/393, pending=[]. Auditorias: A (IA-ACTOR-USERS) PASS_DESIGN ·
B (IA-BANCO) PASS_SCHEMA_PLAN · C (IA-DINHEIRO) PASS_MONEY_PLAN.

## Norma / SSOT

`CONSTITUICAO_UNIFICARD` (actor = unidade econômica soberana) · `AUTHORITY_LAW`/`08_AUTORIDADE` (CPF = raiz
legal; referral_code não é authority) · `LEIS_OPERACIONAIS` Lei 5 + `SSOT_REGISTRY` (Bank = única verdade de
saldo; comissão só nasce em transação real) · `07_NOMENCLATURA` (snake_case; `code_status`; `_cents`; FK actors(id)) ·
`DECISION-0113` (sujeito server-side) · `DECISION-0119` (vínculo puro A→B) · `DECISION-0036` (target_actor_id
resolvido da conta destino) · `DECISION-0139` (regra soberana). SSOT de referral = **novo `actor_referral_codes`**
(lookup econômico do actor, não authority, não ledger). Bank intocado.

## Prova de banco vivo ANTES

`actor_referral_codes`/`referrals` ausentes; `user_referral_links` vazia (6 cols, rowcount 0 → backfill trivial);
`bank_accounts.owner_type` = só `'actor'`; `bank_splits` tem `target_actor_id`(nullable)+`target_account_id`(NOT NULL);
actor_type vivos = user(8)/page(2); `getActorWalletAccount`/`ensureActorWalletAccount` já actor-native.

## Migration

`migrations/20260617120000_actor_referral_codes_and_actor_links.sql` — forward-only, idempotente, **zero Bank**:
1. `actor_referral_codes` (id, tenant_id→tenants(id), **owner_actor_id→actors(id) ON DELETE RESTRICT**, code,
   **code_status** CHECK(active/inactive/revoked), created_by_actor_id→actors(id), created_by_user_id, created_at,
   revoked_at, metadata); `UNIQUE(tenant_id, code)`; índice (tenant_id, owner_actor_id); **partial unique index**
   `idx_..._one_active_per_owner WHERE code_status='active' AND revoked_at IS NULL`; RLS `app.current_tenant`.
2. `user_referral_links` += `referrer_actor_id`/`referred_actor_id` (→actors(id) ON DELETE SET NULL), breadcrumb
   user_* preservado. **Prova DEPOIS:** FKs → actors(id)/tenants(id); índices ok; dev 393→394.

## Código (escopo material)

- **`actor-referral-code.service.ts` (novo):** `resolveCodeOwnerActor[Tx]` (`code→owner_actor_id`, só ativo),
  `getActiveCodeForActor`, `ensureActorReferralCode` (idempotente; **fail-closed `ACTOR_SYSTEM_REFERRAL_FORBIDDEN`**;
  autoria = created_by_actor_id).
- **`referral-helper.getActiveReferral`:** devolve `{ referrerActorId (owner econômico), referrerUserId (breadcrumb) }`;
  compat: vínculo legado sem actor → resolve actor_human do referrer; sem owner resolvível → null (não inventa dono).
- **`referral.service.applyReferralCodeTx`:** **actor-substrate-first** — referrer_actor_id = owner do código
  (legado→actor_human via fallback), referrer_user_id = humano por trás do owner (owner.user_id ou responsável),
  referred_actor_id = actor_human do indicado (**server-side**, nunca client). Grava as 2 novas colunas; idempotente; fail-closed.
- **`bank-split-engine.service.ts`:** earning de referral → **`ensureActorWalletAccount(ownerActorId)`**;
  `target_actor_id = owner` é resolvido pelo **writer canônico** a partir de `bank_accounts.actor_id` da conta
  (DECISION-0036) — **sem alterar `createSplit`/`createEntry`/Bank Core**.
- **`auth.service.ts`:** provisiona o código actor-scoped do novo `actor_human` no signup (pós-commit best-effort).
- **`referral.routes.ts`:** **POST/GET `/referral/actor-code`** com **canRepresentActor** (referral_code não é authority;
  `ownerActorId` é alvo declarativo, só efetiva se representável; actor_system → 400).
- **`publication-engine.generateShareableLink`:** embute o código do **actor server-side** (`getActiveCodeForActor`);
  `body/metadata.referral_code` IGNORADOS como dono econômico (§1.9).
- **E2E:** `validate-pipeline-e2e-referral-link-materialization` adaptado (T4 ao novo retorno).

## Guard + Negative-proof

- Novo `scripts/audit-actor-referral-actor-scoped.mjs` em `validate:regression-guards`: FK do owner **DEVE** ser
  actors(id) (proíbe users / actors(actor_id)); partial unique index; fail-closed actor_system; split via
  `ensureActorWalletAccount` (proíbe regressão a conta-user); `generateShareableLink` server-side (proíbe
  `input.referral_code || metadata.referral_code`); rota actor-code exige canRepresentActor.
- **Negative-proof (mordeu exit 1, restaurou byte-idêntico):** (a) FK owner→users; (b) split via
  `const referrerUserId = await getActiveReferral`; (c) fail-closed actor_system removido; (d) body-injection
  `input.referral_code || metadata.referral_code` → **todos FAIL → restaurados → GATE OK**.

## E2E

- **`run-actor-referral-substrate-ephemeral.ps1` → 15/15 verdes:** código PF→owner PF · banda/page→owner banda
  (não CPF criador) · mesmo CPF N actors N códigos (non-mixing) · actor_system fail-closed · referrer_actor_id=owner ·
  referred_actor_id=actor_human server-side · getActiveReferral=owner · earning target=actor_wallet do owner ·
  `bank_accounts.actor_id`=owner (writer resolve target_actor_id=owner) · earnings banda ≠ wallet CPF · idempotência ·
  body/inexistente→null · canRepresentActor 403/true · **bank_ledger intocado**.
- `referral-link-materialization` → **14/14** (efêmera, adaptado).

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente) · check:migrations OK · tsc **25** baseline (0 na frente).

## Escopo negativo (verificado)

NÃO tocado: `bank_ledger`/`createEntry` · `bank_splits` schema · `createSplit`/Bank Core · payout · janela de 5 anos ·
RBAC · `users.referral_code` (mantido legado/compat) · `modules/marketplace/referral.*` (dormante; tabela ausente);
CPF/user **não** vira dono econômico; body/metadata **não** define dono; actor_system **não** recebe código.

## Resíduos

(1) janela de 5 anos **PENDENTE CLAYTON**; (2) auto-hook de código para page/group/derivado via endpoint
canRepresentActor (signup só auto-provisiona user_actor); (3) `marketplace/referral.*` dormante — limpeza/compat
em fatia própria; (4) `bank_splits.referral_link_id`/CHECK fora do escopo; (5) deprecação de `users.referral_code`.

## Warnings não-bloqueantes (reseal Yala = PASS_WITH_WARNINGS)

- **W1** — negative-proof narrada neste log, **sem script reproduzível versionado**. Melhoria futura de
  Evidence Pack / guard reproducibility. Não bloqueia (guard ativo e provado).
- **W2** — `REFERRAL_PERCENTAGE = 5%` hardcoded no split-engine. **Decisão de política futura**; **NÃO foi
  introduzida** por esta frente (já existia; DECISION-0119/0048 governam percentual/janela).
- **W3** — `validate:architectural-rules.ts` vermelho em profile. **DT própria, fora do escopo** desta frente
  (pré-existente; não introduzido pelo patch).
- **W4** — reexecução fresca do `referral-link-materialization` → **14/14 verdes** (DB efêmera, 2026-06-17, pós-seal).

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-17 sobre commit material `6e94916f`; reseal Yala
material READ-ONLY = PASS_WITH_WARNINGS não-bloqueantes). dev **394/394**. `DT-ACTOR-SCOPED-REFERRAL-USER-ONLY`
→ **CLOSED**. **Confirmado no seal:** Bank Core/writer/ledger/`bank_splits` intocados; earnings → `actor_wallet`
do owner; `referral_code` = lookup, nunca authority; body/metadata neutralizado server-side; `actor_system`
fail-closed; `canRepresentActor` obrigatório; `referred_actor_id` server-side. **Janela de 5 anos permanece
PENDENTE CLAYTON** (não decidida por esta frente). Nenhum código material alterado no seal.
