# 2026-06-17 — F-REFERRAL-REGISTER-ACTOR-CODE-GATE (material, cirúrgico)

Corrige a **porta de entrada do cadastro** (DECISION-0139): o motor novo (`applyReferralCodeTx`) já entendia
código ACTOR-SCOPED (`actor_referral_codes`), mas a catraca pública ainda só aceitava o legado
(`users.referral_code`) — um código de empresa/banda/página/grupo existia no substrato, funcionava no service
direto, mas era barrado no cadastro público como "Código de indicação inválido" antes de chegar no writer
soberano. Esta frente liga a entrada ao substrato actor-scoped, mantendo compat legado. Non-money; sem
migration/schema; Bank/ledger/splits, writer soberano, economia de referral e R1-R6.2 intocados.

## Anchor / Pré-flight

HEAD inicial `dee733fa` · branch `rescue-structural` · dev 394 · pending=[]. Cadeia R6.2 presente
(`c41476f7` material · `dee733fa` seal). Sem sujeira material em referral/auth/actor/bank/migrations.
**P1:** corrige a porta de entrada do cadastro para usar o substrato actor-scoped; NÃO muda writer soberano,
NÃO muda economia, NÃO move dinheiro, NÃO mexe em Bank/ledger/splits. Schema vivo confere
(`actor_referral_codes` migration `20260617120000`); DECISION-0139 existe → sem HOLD_SCHEMA_OR_DECISION.

## Causa-raiz (READ-FIRST)

- **`/auth/check-referral`** (`auth.routes.ts:599-666`): resolvia só `SELECT user_id FROM users WHERE
  UPPER(referral_code)=UPPER($2)` (user-only). Shape estável `{ valid: boolean }`.
- **`authService.register` pré-validação** (`auth.service.ts:275-287`): mesma query user-only ANTES da
  transação → código actor-scoped válido caía em 400 `INVALID_REFERRAL_CODE` antes de qualquer escrita.
- **Writer soberano `applyReferralCodeTx`** (`referral.service.ts:103-192`): JÁ resolve actor-scoped primeiro
  (`resolveCodeOwnerActorTx` → `owner_actor_id`) com fallback legado, grava `user_referral_links`
  (`referrer_actor_id`/`referred_actor_id` + breadcrumb civil), fail-closed, idempotente, sem Bank — **não
  precisa de mudança**.
- **Resolver não-tx** `actorReferralCodeService.resolveCodeOwnerActor` já existia (read-only), mas sem fallback
  legado e sem o gate de `actor_system` ao nível de leitura.

## Correção (cirúrgica — resolver único + 2 pontos de entrada)

**Resolver ÚNICO read-only** `referralService.resolveReferralCodeCandidate(tenantId, code)`
(`referral.service.ts`): retorna `{ valid, kind: 'actor'|'legacy'|null, ownerActorId }`. Ordem espelha o
writer — (1) `actor_referral_codes` ATIVO via **JOIN em `actors` excluindo `actor_type IN ('system',
'actor_system')`** (fail-closed server-side mesmo p/ linha CRUA semeada); (2) fallback legado
`users.referral_code`; (3) inexistente → inválido. **Não escreve, não cria vínculo/actor/wallet, não toca
Bank.** A materialização do vínculo continua EXCLUSIVA de `applyReferralCodeTx` — o resolver só responde
"existe e é válido?".

**`/auth/check-referral`**: troca a query user-only por `resolveReferralCodeCandidate`; retorna
`{ valid: candidate.valid }` (shape estável; 500 honesto em erro técnico preservado). Frontend inalterado
(contrato HTTP idêntico).

**`register` pré-validação**: troca a query user-only por `resolveReferralCodeCandidate`; `!valid` →
**400 `INVALID_REFERRAL_CODE`** ANTES da transação (zero estado parcial). `applyReferralCodeTx` dentro da
transação de nascimento **inalterado**.

## E2E

`run-referral-register-actor-code-gate-ephemeral.ps1` → **23/23 verdes** (DB efêmera dedicada
`unificard_referral_register_actor_code_gate_e2e`, nunca unificard_dev; HTTP real via `fastify.inject` em
`POST /auth/register`):
- **A (resolver / check-referral semantics):** A1 actor-scoped → valid:true kind=actor owner=banda · A2 legado
  → valid:true kind=legacy · A3 inexistente → valid:false · A4 actor-scoped case-insensitive.
- **B/C (register actor-scoped page):** B1 201 · B2 `user_referral_links` criado na transação · C1
  `referrer_actor_id`=owner do código (banda) · C2 `referred_actor_id`=actor_human do novo user (server-side)
  · C3 `referrer_user_id`=humano gestor por trás do owner.
- **D (fallback legado):** D1 register com `users.referral_code` → 201 · D2 `referrer_user_id`=dono legado ·
  D3 `referrer_actor_id`=actor_human do referrer.
- **E (inválido):** E1 → 400 `INVALID_REFERRAL_CODE` · E2 zero global_user/user/identity/actor/link novos.
- **F (actor_system fail-closed):** F1 resolver recusa owner system (valid:false) · F2 register → 400 · F3
  zero vínculo/estado residual.
- **G (Bank intocado):** G1/G2/G3 `bank_ledger`/`bank_transactions`/`bank_splits` inalterados.
- **H (regressão):** H1 guard R6.2 social-posts verde · H2 guard R6.1 services verde · H3 guard da frente verde.

## Guard + Negative-proof

Novo `scripts/audit-referral-register-actor-code-gate.mjs` em `validate:regression-guards`: exige
`resolveReferralCodeCandidate` consultando `actor_referral_codes` ANTES do fallback legado (ordem), com gate
`actor_type NOT IN ('system','actor_system')`; exige `/auth/check-referral` e a pré-validação de `register`
usando o resolver; proíbe `UPPER(referral_code)` legacy-only nesses dois pontos; proíbe `INSERT INTO
user_referral_links` fora do writer (`referral.service.ts`); exige `applyReferralCodeTx` ainda invocado;
proíbe escrita em `bank_(ledger|transactions|splits)` nos arquivos da frente; cross-check de que o gate R6.2
social-posts segue intacto. **Negative-proof versionado** `scripts/negative-proof-referral-register-actor-
code-gate.ps1` (ASCII puro, sem BOM, pwsh 7 **e** Windows PowerShell 5.1): degrada o resolver para legacy-only
(remove o lookup `actor_referral_codes`) → **GATE FAIL (exit 1)** → restaura byte-idêntico → **git status
inalterado** → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente: marketplace + e2e scripts, nenhum nas minhas
alterações) · check:migrations OK (**sem migration**) · tsc baseline **43** — **0 erro novo na frente**.

## Escopo negativo

Sem migration/schema; writer soberano `applyReferralCodeTx` **inalterado**; `applyReferralCode`/
`resolveCodeOwnerActor(Tx)`/`ensureActorReferralCode`/`getActiveReferral` inalterados; frontend inalterado
(contrato HTTP idêntico); Bank Core/`bank_ledger`/`bank_transactions`/`bank_splits`, economia/payout/split de
referral, R1/R2/R3/R4/R5/R6.1/R6.2, `applyReferralCodeTx`, feed-action/event-rfq/venue/system-notifications/
store-onboarding/business-permissions/unifycard **intocados**; DT-mãe 0113 **não fechada**.

## Estado

**🟡 IMPLEMENTED / HOLD YALA.** `DT-REFERRAL-REGISTER-ACTOR-CODE-GATE-LEGACY-ENTRYPOINT` →
**IMPLEMENTED_AS_CONTAINED / HOLD YALA**. **Esta frente corrigiu somente a porta de entrada do cadastro para
reconhecer códigos actor-scoped de referral. Não altera a economia do referral, não cria payout/split, não
toca Bank/ledger/splits e não fecha frentes de authority 0113.** **Continuidade (NÃO executar agora):** R6.3
feed-action · R7 event-rfq money-adjacent · rota legada `/social/posts/create` (follow-up/DT futura) · guard
cross-module Z2. CLOSED só no seal pós-Yala PASS material.
