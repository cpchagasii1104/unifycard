# 2026-06-13 — F-REFERRAL-LINK-MATERIALIZATION-AND-SPLIT-CONTRACT

GO cirúrgico após o reseal Yala da `F-REGISTER-PRELAUNCH-BLOCKERS-CLOSURE`
(commit `1b2dcbe9`) com veredito **PASS COM RESSALVA**: cadastro com referral
válido deixou de travar, mas o vínculo econômico A→B não materializa.

## Âncora

- Parent: `1b2dcbe9` · branch `rescue-structural` · dev `unificard_dev` 376→**377/377**.
- Classificação: IDENTIDADE/ONBOARDING + MONEY-ADJACENT (não é frente Bank).

## Causa-raiz (Yala)

`applyReferralCode` legado apontava para estruturas ausentes/incompatíveis:
`users.metadata.referred_by`, `user_referral_links` (AUSENTE no schema vivo,
`to_regclass` = NULL) e `referrals` (arquivada, com `link_id`/`percentage_bps`/
`status`/`startsAt`/`endsAt` — política financeira embutida). Falhava em
best-effort pós-commit e era engolido → `getActiveReferral` devolvia `null`;
o split futuro nunca encontrava o referrer.

## DECISION-0119 (promulgada ANTES do patch — pré-condição Yala)

`docs/02_decisions/DECISION_0119_REFERRAL_LINK_PURE_VINCULO.md`: D1 vínculo puro
(sem percentual/janela/status/política) · D2 atomicidade fail-closed (válido sem
vínculo ⇒ rollback) · D3 engine-neutro (legado + economic_policy_engine; sem
cutover da 0048) · D4 money-adjacent, não Bank writer · D5 integridade
(sem autoindicação; um referrer por indicado; tenant-safe; idempotente; imutável).

## Patch

| Arquivo | Mudança |
| --- | --- |
| `migrations/20260613120000_user_referral_links.sql` (NOVO) | tabela canônica `link_id`/`tenant_id`/`referrer_user_id`/`referred_user_id`/`referral_code_used`/`created_at`; `UNIQUE(tenant_id, referred_user_id)`; `CHECK(referrer<>referred)`; índice `(tenant_id, referrer_user_id)`; RLS `app.current_tenant`. SEM percentual/bps/janela/starts_at/ends_at/status/expiração/`updated_at`/vínculo a `referrals`. Forward-only; não reaplica `0070`/`0077`; zero Bank. |
| `core/referral/referral.service.ts` | `applyReferralCodeTx(client, tenant, referred, code)` — writer transacional puro (resolve referrer no tenant; valida não-autoindicação; INSERT ON CONFLICT DO NOTHING; **fail-closed**: vínculo não materializado para código válido ⇒ lança). `applyReferralCode` vira wrapper `withTransaction`→`applyReferralCodeTx` (POST /referral/apply preservado). Removidos `users.metadata` e `referrals`/`link_id` legado. |
| `core/auth/auth.service.ts` | aplicação do referral movida de pós-commit best-effort para DENTRO da `withTransaction` do nascimento (mesmo `client`, após user/identity/actor). Referral válido + falha de vínculo = exceção sobe = rollback total. Validação pré-tx (400 inválido) mantida. |
| `core/referral/referral-helper.service.ts` | `getActiveReferral` lê SÓ `user_referral_links` (fonte canônica), janela de 1 ano como REGRA DE LEITURA (não coluna); ramo `referrals` neutralizado. |

## DDL (resumo)

```
user_referral_links(
  link_id uuid PK default gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_used text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, referred_user_id),
  CHECK(referrer_user_id <> referred_user_id))
+ index(tenant_id, referrer_user_id) + RLS tenant isolation
```
Checksum aplicado no dev: `9028b77f3dd35a233731640946eca14d338abeaded90a2d7a6aa419067fe1224`.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `validate-pipeline-e2e-referral-link-materialization` (DB efêmera) | **14/14** |
| T1 A nasce sem referral + referral_code próprio | ✅ |
| T2 B cadastra com código de A → 201 | ✅ |
| T3 vínculo A→B (tenant/referrer=A/referred=B/code) | ✅ |
| T4 getActiveReferral(tenant, B) === A | ✅ |
| T5 código inválido → 400; B inexiste em users/identities/actors/profiles | ✅ |
| T6 autoindicação lança e não cria vínculo | ✅ |
| T7 cross-tenant → null | ✅ |
| T8 idempotência: vínculo não duplica (1→1) | ✅ |
| T9 falha forçada (tabela ausente) c/ código válido → ROLLBACK total | ✅ |
| T10 cadastro NÃO cria bank_ledger/transactions/splits/accounts | ✅ |
| T11 split não dispara no cadastro | ✅ |
| T12 split-engine 5% + leitura da fonte pura (getActiveReferral) intactos | ✅ |
| Regressão c1-birth-minimum-atomic | **29/29** |
| Regressão register-prelaunch-blockers | **22/22** |
| Regressão c1-read-purity + c1-human-journey | CLOSED (regression-guards EXIT 0) |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 · arch --strict critical_new=0 |
| tsc | backend 25 pré-existentes (arco 0113), ZERO novo em auth/referral/identity; frontend 0 |
| git diff --check | 0 |

## Cleanup

dev **377/377** byte-estável; `user_referral_links` vivo com **0 linhas**;
`bank_ledger`/`bank_transactions`/`bank_splits` = 0 (sem escrita no cadastro);
zero DB efêmera; órfão de link gerado pelo cleanup-com-`session_replication_role=replica`
do e2e de regressão foi removido (varredura `NOT EXISTS users`). Working tree =
frente + drift protegido. (Pré-existentes não desta frente: 1 bank_account e
6 usuários `e2e-company-*` de 10–11/jun — bank_account é hard-stop, não tocado.)

## Cartório

- DECISION-0119 promulgada.
- `DT-REFERRAL-LEGACY-CLEANUP` registrada **OPEN** (remover `users.metadata.referred_by`,
  decidir tombstone da `referrals` arquivada, confirmar split-engine lendo só a fonte pura,
  higiene de órfãos por `replica`).

## Estados

- F-REFERRAL-LINK-MATERIALIZATION-AND-SPLIT-CONTRACT: **IMPLEMENTED / HOLD para reseal Yala**.
- A1 money-adjacent: **CLOSED candidato, aguardando reseal**.
- Não continuar para authority/PJ/cargos/grants/CNAE.
