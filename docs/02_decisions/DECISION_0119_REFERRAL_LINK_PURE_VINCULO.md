# DECISION-0119 — Referral link / vínculo de indicação como relação pura

**Data:** 2026-06-13
**Tipo:** Identidade / Onboarding · **money-adjacent (NÃO Bank writer)**
**Status:** PROMULGADA — autoriza a materialização do **vínculo puro A→B** atômico ao nascimento do usuário, engine-neutro, **sem qualquer escrita Bank**. **NÃO** ativa `referrer_actor_wallet`; **NÃO** faz cutover da `DECISION-0048`; **NÃO** altera percentual/janela/política de split; **NÃO** libera R2/delegação; **NÃO** ativa FASE 6; **NÃO** toca PJ/CNAE/catálogo/permissões.
**Frente:** `F-REFERRAL-LINK-MATERIALIZATION-AND-SPLIT-CONTRACT`
**HEAD de origem:** `1b2dcbe9`
**Decisor:** Clayton / IA Diretora (READ-FIRST Yala/Opus `PASS PARA EXECUTAR`, pré-condição: promulgar esta DECISION antes do patch)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (Art. I — Soberania do Ator), `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5 — Bank SSOT; comissão só nasce em transação econômica real), `DECISION-0115 D1` (tenant inicial vivo compartilhado; nascimento atômico), `DECISION-0113` (sujeito = `req.user` server-side), `DECISION-0048` (split-engine de indicação — **não sofre cutover aqui**).
**Vinculada a:** `DT-REFERRAL-LEGACY-CLEANUP` (OPEN — `users.metadata.referred_by` e a tabela `referrals` arquivada/incompatível são arqueologia a remover em fatia própria).

---

## 1. Contexto / causa-raiz

O reseal Yala da frente `F-REGISTER-PRELAUNCH-BLOCKERS-CLOSURE` (commit `1b2dcbe9`) deu **PASS COM RESSALVA**: o cadastro com referral válido deixou de travar (A1 UX), mas o **vínculo econômico A→B não materializa**. O `applyReferralCode` legado apontava para estruturas ausentes/incompatíveis (`users.metadata`, `user_referral_links` inexistente no schema vivo, `referrals` arquivada com `link_id`/`percentage_bps`/`status`), falhava em best-effort pós-commit e era **engolido**. Consequência material: `to_regclass('public.user_referral_links')` = NULL e `to_regclass('public.referrals')` = NULL no dev vivo; `getActiveReferral(tenant, B)` retorna `null`; o split futuro nunca encontra o referrer.

A causa-raiz é a **ausência de uma fonte canônica do vínculo de indicação** — relação pura, separada de qualquer política financeira.

## 2. O que esta DECISION promulga

### D1 — Vínculo puro
O código de indicação materializa uma relação **imutável A→B**: *referrer indicou referred*. A tabela de vínculo **não guarda** percentual, janela, expiração financeira, status financeiro nem política de split.

### D2 — Atomicidade e fail-closed
Se B se cadastra com código **válido** de A, a gravação do vínculo A→B faz parte da **transação de nascimento**. Se o vínculo não puder ser gravado, o cadastro inteiro faz **rollback total**. **Não pode existir usuário indicado sem vínculo materializado quando o código era válido.**

### D3 — Engine-neutro
A fonte do vínculo serve tanto ao **split-engine legado** quanto ao futuro **economic_policy_engine**. Esta frente **não** faz cutover da `DECISION-0048`, **não** ativa `referrer_actor_wallet` e **não** altera política financeira.

### D4 — Money-adjacent, não Bank writer
O cadastro **não cria** `bank_ledger`, `bank_transactions`, `bank_splits` nem `bank_accounts`. A comissão futura só pode nascer em **transação econômica real** (Lei 5).

### D5 — Integridade
Sem autoindicação (`referrer_user_id <> referred_user_id`). **Um referrer por usuário indicado** dentro do tenant (`UNIQUE (tenant_id, referred_user_id)`). Tenant-safe (RLS por `app.current_tenant`). Idempotente (`ON CONFLICT DO NOTHING`). Imutável após criação (sem `updated_at`; sem writer de UPDATE).

## 3. Materialização ratificada

- Tabela canônica `user_referral_links` (migration forward-only nova): `link_id`/`tenant_id`/`referrer_user_id`/`referred_user_id`/`referral_code_used`/`created_at`, `UNIQUE(tenant_id, referred_user_id)`, `CHECK(referrer <> referred)`, índice `(tenant_id, referrer_user_id)`, RLS habilitada. **Sem** percentual/bps/janela/starts_at/ends_at/status/expiração/política/`updated_at`; **sem** vínculo a `referrals`.
- `applyReferralCode` reescrito como writer **transacional puro** (recebe o `client` do nascimento; resolve referrer pelo código no tenant; valida não-autoindicação; insere em `user_referral_links` com `ON CONFLICT (tenant_id, referred_user_id) DO NOTHING`; **lança em falha real de gravação para código válido** → rollback). Sem `users.metadata`, sem `referrals`, sem `link_id` legado.
- `register` move a aplicação do referral de **pós-commit best-effort** para **dentro da `withTransaction`**, após user/identity/actor mínimos, no mesmo `client`. Referral válido + falha de vínculo = exceção sobe = rollback total.
- `getActiveReferral` lê a fonte canônica `user_referral_links`, preservando a **janela de 1 ano como regra de leitura** (não como coluna). O ramo `referrals` (tabela ausente/incompatível) é neutralizado.

## 4. Limites desta DECISION (o que ela NÃO faz)

Não altera `bank-split-engine.service.ts` (salvo leitura), `economic_policy_engine`, percentual de 5%, janela/política financeira, `referrer_actor_wallet`, cutover da `DECISION-0048`. Não toca PJ/CNAE/catálogo/permissões/autoridade/cargos/grants/R2/FASE 6. Não restaura migrations arquivadas `0070`/`0077`. A comissão futura permanece responsabilidade da frente financeira.

## 5. Consequências / trilho

- `DT-REFERRAL-LEGACY-CLEANUP` registrada **OPEN**: remover `users.metadata.referred_by` e a tabela `referrals` arquivada (arqueologia incompatível) em fatia própria; o split-engine deve passar a ler o vínculo puro via `getActiveReferral`.
- A comissão de indicação (5%, janela 1 ano) permanece governada por `DECISION-0048`/split-engine, lendo o vínculo puro — **sem** que percentual/janela virem colunas do vínculo.

## 6. Referências

`docs/02_decisions/DECISION_0119_REFERRAL_LINK_PURE_VINCULO.md`; HEAD âncora `1b2dcbe9`; reseal Yala `PASS COM RESSALVA` da frente `F-REGISTER-PRELAUNCH-BLOCKERS-CLOSURE`; `referral.service.ts`, `referral-helper.service.ts`, `auth.service.ts` (register/`withTransaction`); `transaction.helper.ts`/`getClientWithTenant` (RLS `app.current_tenant`); `DECISION-0048`/`0113`/`0115`; Lei 5.
