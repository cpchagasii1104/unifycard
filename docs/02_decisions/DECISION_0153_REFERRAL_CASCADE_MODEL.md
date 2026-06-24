# DECISION-0153 — Referral Cascade Model: por-usuário (Modelo B) · F-REFERRAL-CASCADE-MODEL-DECISION

**Status:** **PROMULGADA / DECISÃO DE PRODUTO (REFERRAL) / DOCS + PROVA PRÉ-MONEY** (Clayton 2026-06-23). Decide o modelo de cascata. **NÃO** implementa a materialização financeira da cascata (actor→owner-user) — essa é FINANCEIRA e fica HOLD.
**Data:** 2026-06-23 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `cca6cb2a` · **Insumo:** Decision Pack (READ-FIRST 3 ângulos + verificação 1ª mão).
**Deriva de / coerente com:** DECISION-0139 (referral actor-scoped — owner_actor_id é dono econômico) · DECISION-0036 (target_actor_id via conta destino) · DECISION-0110 (firewall financeiro). Ordem: SEMÂNTICA → IDENTIDADE → AUTORIDADE → ESTADO → **FINANCEIRO**.

---

## §A — A DECISÃO (Modelo B — por usuário)
1. **Modelo B (por-usuário):** o **indicador econômico** (identificado pelo `owner_actor_id` do `actor_referral_codes`) participa de **receita elegível** gerada pelo usuário indicado e, **futuramente**, por actors economicamente operados por esse usuário — desde que a resolução seja **server-side e canônica** (actor→owner-user→`getActiveReferral`).
2. **Modelo C (multinível/cadeia inteira) — REJEITADO.** NÃO existe A→B→C gerando ganho para A por múltiplos níveis. **Proibido** implementar recursão/multilevel referral (pirâmide/regulatório).
3. **Modelo A (vínculo direto)** é o estado parcial atual (nível direto), insuficiente sozinho para a tese — B é a meta.
4. **Referral é LOOKUP econômico, NÃO autoridade** (não concede permissão). **Autoindicação proibida.** **`actor_system` proibido** como owner econômico. **Split de referral SÓ dentro do Bank** (bank-split-engine; nunca paralelo).

## §B — Estado vivo reconhecido (de 1ª mão)
- **Referral DIRETO user-level JÁ VIVO:** A indica B → `applyReferralCodeTx` grava `user_referral_links` (A→B, idempotente, fail-closed, sem autoindicação) → `getActiveReferral(B)` resolve `owner_actor_id` de A → `calculateSplits(fromUserId=B)` emite split `referral` (5% `REFERRAL_PERCENTAGE`) ao actor_wallet de A.
- **Earning é FINANCEIRO:** `createTransactionWithSplits` materializa **bank_ledger CREDIT + bank_splits + actor_wallet**. `calculateSplits` cria a actor_wallet (`ensureActorWalletAccount`) — write.
- **Cascade PLENO (actors de B → A) NÃO existe:** colunas `referrer_actor_id`/`referred_actor_id` são substrato; **não há resolver** que mapeie "actor gerador de receita → owner-user (B) → getActiveReferral(B)". O `fromUserId` é decidido pelo caller. → **futuro + financeiro.**
- `rides_referral_*` = substrato LEGADO separado (não integrado ao core) — candidato a unificação (fora desta decisão).

## §C — HOLD (materialização financeira da cascata)
A resolução **actor→owner-user** no split-engine (o que torna o Modelo B PLENO) é **FINANCEIRA** (toca bank_ledger/bank_splits/actor_wallet) → **HOLD** até: **RLS-live + Camada 1 + 3 paralelas + GO financeiro próprio**. Dinheiro real continua HOLD.

## §D — O que o E2E prova
- **(pré-money, roda agora — `e2e-referral-cascade-intent-premoney`):** A indica B → `user_referral_links` grava A→B → `getActiveReferral(B)` resolve `owner_actor_id` de A. **Δbank_ledger=0 · Δbank_splits=0 · Δbank_accounts=0** (NÃO chama `calculateSplits`/`createTransactionWithSplits`). Zero permissão concedida. ✅ 4/4 PASS.
- **(money-on, HOLD):** split-intent (`calculateSplits` cria wallet) + earning real (bank_ledger) — FINANCEIRO, 3 paralelas, Camada 1.

## §E — Enforcement
Guard `audit-referral-cascade-model.mjs`: (1) split-engine resolve referral **single-level** por `getActiveReferral(tenantId, fromUserId)` (uma chamada; sem recursão/multilevel); (2) **cascade actor→owner-user NÃO wired** (fromUserId não é derivado de actor no split-engine — material HOLD); (3) sem `REFERRAL_PERCENTAGE` em níveis/array; (4) split `referral` só no bank-split-engine. Existentes: `audit-actor-referral-actor-scoped` + `audit-referral-register-actor-code-gate` (actor-scoped + não-autoridade).
