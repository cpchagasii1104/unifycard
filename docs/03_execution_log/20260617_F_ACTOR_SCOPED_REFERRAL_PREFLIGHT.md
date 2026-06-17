# 2026-06-17 — F-ACTOR-SCOPED-REFERRAL-PREFLIGHT (docs-only)

Promulgação **docs-only** de `DECISION-0139 — Actor-Scoped Referral Code & Earnings`, a partir de auditoria
READ-ONLY que retornou **veredito USER_ONLY**. Nenhum código, migration, banco ou frontend tocado.

## Anchor / Pré-flight

HEAD `1565a184` · branch `rescue-structural` · dev 393. Sem sujeira material em `backend/src`/`migrations`/
`scripts`/`package.json`/`frontend/src`; nada staged. Pré-flight GREEN.

## Auditoria READ-ONLY — veredito USER_ONLY

O diferencial Unificard (código de indicação **por actor**) **ainda não está materialmente implementado**.

**Estado vivo (user-only):**
- `users.referral_code` = fonte viva (user-scoped).
- `user_referral_links` liga **user↔user** (`referrer_user_id`/`referred_user_id`/`referral_code_used`).
- check-referral resolve **user**; split referral resolve **conta do user**.
- actors derivados **não nascem com código próprio**.
- `generateShareableLink` aceita `referral_code` solto em `body`/`metadata` → **vetor DIVERGENT**.
- `referral_codes(owner_actor_id)` existe só em **archive/docs**, não como fonte viva.

**Achado positivo (infra financeira já actor-native):**
- `bank_accounts.owner_type='actor'` no DB; `actor_wallet` para qualquer actor;
  `getActorWalletAccount`/`ensureActorWalletAccount` já suportam o actor econômico.

**Conclusão:** o gap **NÃO** está no Bank/wallet — está na **identidade canônica do código**
(`actor_referral_codes` ausente) e no **resolver do split** (resolve user, não `owner_actor_id`).

## Decisão promulgada (resumo)

`DECISION-0139` (PROMULGADA / DOCS-ONLY) — 13 regras soberanas: CPF/`actor_human` = raiz legal/civil/fiscal/
rastreável, nunca substituído por `referral_code`; `actor` = unidade econômica soberana; **código pertence a
`owner_actor_id`**; **earnings → `actor_wallet` do owner**; **CPF não captura earnings por reflexo**; `referral_code`
= lookup, nunca authority; `body.referral_code` arbitrário não define dono econômico; operar por delegação não
transfere ownership econômico. Exemplos: PF→wallet PF · banda→wallet banda · empresa/página/grupo→wallet do
actor · 1 CPF com N actors **não mistura earnings**.

**Janela de 5 anos:** **PENDENTE CLAYTON** — mencionada como produto, **sem prova documental formal** nesta
auditoria; **NÃO promulgada** até ratificação explícita/referência documental. Não se afirma que está ratificada.

## Reconciliação com DECISION-0134 (append-only)

`DECISION-0134 §2` (código pertence ao actor; lookup, não authority) **permanece vigente**. A 0139 **build-on /
supersede parcial**: adiciona a dimensão econômica/earnings + estado material USER_ONLY + vetor `body.referral_code`
+ frente material. História da 0134 **não apagada/reescrita** — recebeu apenas: (a) ponteiro no topo do arquivo
`DECISION_0134_*.md`; (b) campo "Superada por: DECISION-0139 (parcial)" no `REMEDIATION_DECISIONS_LOG.md`.

## DT + próxima frente

- `DT-ACTOR-SCOPED-REFERRAL-USER-ONLY` — **OPEN / PRODUCT_DIFFERENTIATOR_NOT_MATERIALIZED · MONEY_ADJACENT · AUTHORITY_ADJACENT.**
- `F-ACTOR-REFERRAL-CODE-SUBSTRATE` (planejada, não implementada): `actor_referral_codes`(owner_actor_id) ·
  evoluir `user_referral_links`→actor↔actor (user_id/global_user_id breadcrumb) · gerar código no nascimento do
  actor · split por `getActorWalletAccount(ownerActorId)` · travar `body.referral_code` · E2Es PF/banda/empresa/
  grupo + non-mixing · guards. **STOPs:** 3 paralelas READ-ONLY antes de código; não tocar Bank Core fora de APIs
  canônicas; **não escrever `bank_ledger`**; code/slug/referral = lookup, nunca authority.

## Gate

`validate-architectural-patterns.mjs --strict` → critical_new=0 (warning_new pré-existente, fora desta frente).
Diff staged = apenas `.md`. **Nada material tocado.**

## Estado

**✅ DECISION-0139 PROMULGADA (docs-only).** Frente preflight encerrada como promulgação documental; a
implementação material é `F-ACTOR-REFERRAL-CODE-SUBSTRATE` (gated, futura). Janela de 5 anos PENDENTE CLAYTON.
